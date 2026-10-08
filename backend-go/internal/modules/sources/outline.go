package sources

import (
	"context"
	"encoding/json"
	"math"
	"os"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
)

// outline checks the GeoJSON outline of Germany. The area is computed in
// EPSG:3035, an equal-area projection, so it is the true area.
type outline struct{ minKm2, maxKm2 float64 }

type position = [2]float64
type ring = []position
type polygon = []ring

type geoObject struct {
	Type        string          `json:"type"`
	Coordinates json.RawMessage `json:"coordinates"`
	Geometry    *geoObject      `json:"geometry"`
	Geometries  []geoObject     `json:"geometries"`
	Features    []geoObject     `json:"features"`
	CRS         *struct {
		Properties struct {
			Name string `json:"name"`
		} `json:"properties"`
	} `json:"crs"`
}

// polygonsOf collects the polygons of a GeoJSON object of each type.
func polygonsOf(o geoObject) ([]polygon, error) {
	switch o.Type {
	case "FeatureCollection":
		return flatPolygons(o.Features)
	case "Feature":
		if o.Geometry == nil {
			return nil, nil
		}
		return polygonsOf(*o.Geometry)
	case "GeometryCollection":
		return flatPolygons(o.Geometries)
	case "Polygon":
		var p polygon
		if err := json.Unmarshal(o.Coordinates, &p); err != nil {
			return nil, Fail("geometry", "bad Polygon coordinates: %v", err)
		}
		return []polygon{p}, nil
	case "MultiPolygon":
		var ps []polygon
		if err := json.Unmarshal(o.Coordinates, &ps); err != nil {
			return nil, Fail("geometry", "bad MultiPolygon coordinates: %v", err)
		}
		return ps, nil
	default:
		return nil, Fail("geometry", "the type %q is not a polygon type", o.Type)
	}
}

func flatPolygons(objects []geoObject) ([]polygon, error) {
	nested, err := fn.MapErr(objects, polygonsOf)
	if err != nil {
		return nil, err
	}
	return fn.FlatMap(nested, func(p []polygon) []polygon { return p }), nil
}

// planarCRS tells if the coordinates are EPSG:3035 metres. A file without
// a crs member is WGS84, as RFC 7946 says.
func planarCRS(o geoObject) (bool, error) {
	if o.CRS == nil {
		return false, nil
	}
	name := o.CRS.Properties.Name
	switch {
	case strings.Contains(name, "3035"):
		return true, nil
	case strings.Contains(name, "4326"), strings.Contains(name, "CRS84"), strings.Contains(name, "4258"):
		return false, nil
	default:
		return false, Fail("crs_unsupported", "the CRS %q is not WGS84 or EPSG:3035", name)
	}
}

func checkRing(r ring, planar bool) error {
	if len(r) < 4 || r[0] != r[len(r)-1] {
		return Fail("geometry", "a ring has fewer than 4 positions or is not closed")
	}
	for _, p := range r {
		if math.IsNaN(p[0]) || math.IsInf(p[0], 0) || math.IsNaN(p[1]) || math.IsInf(p[1], 0) {
			return Fail("geometry", "a position is not a finite number")
		}
		if !planar && (math.Abs(p[0]) > 180 || math.Abs(p[1]) > 90) {
			return Fail("geometry", "the position %v is not in degrees", p)
		}
	}
	return nil
}

// shoelace gives the area of a ring in square metres.
func shoelace(r ring, planar bool) float64 {
	points := r
	if !planar {
		points = fn.Map(r, func(p position) position {
			x, y := geo.LAEA3035(p[0], p[1])
			return position{x, y}
		})
	}
	sum := 0.0
	for i := 0; i+1 < len(points); i++ {
		sum += points[i][0]*points[i+1][1] - points[i+1][0]*points[i][1]
	}
	return math.Abs(sum) / 2
}

// polygonArea is the outer ring less the holes.
func polygonArea(p polygon, planar bool) float64 {
	return fn.Reduce(p[1:], shoelace(p[0], planar), func(acc float64, hole ring) float64 {
		return acc - shoelace(hole, planar)
	})
}

func extent(ps []polygon) []float64 {
	box := []float64{math.Inf(1), math.Inf(1), math.Inf(-1), math.Inf(-1)}
	for _, p := range ps {
		for _, q := range p[0] {
			box = []float64{min(box[0], q[0]), min(box[1], q[1]), max(box[2], q[0]), max(box[3], q[1])}
		}
	}
	return box
}

func (o outline) Validate(ctx context.Context, v *Version) (map[string]any, error) {
	raw, err := os.ReadFile(v.Original())
	if err != nil {
		return nil, err
	}
	var doc geoObject
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, Fail("geojson", "the file is not JSON: %v", err)
	}
	planar, err := planarCRS(doc)
	if err != nil {
		return nil, err
	}
	polygons, err := polygonsOf(doc)
	if err != nil {
		return nil, err
	}
	polygons = fn.Filter(polygons, func(p polygon) bool { return len(p) > 0 })
	if len(polygons) == 0 {
		return nil, Fail("geometry", "the file has no polygon")
	}
	for _, p := range polygons {
		for _, r := range p {
			if err := checkRing(r, planar); err != nil {
				return nil, err
			}
		}
	}
	km2 := fn.Reduce(polygons, 0.0, func(acc float64, p polygon) float64 { return acc + polygonArea(p, planar) }) / 1e6
	v.Logf("%d polygons, %.0f km²", len(polygons), km2)
	if km2 < o.minKm2 || km2 > o.maxKm2 {
		return nil, Fail("area", "the area is %.0f km², expected %.0f to %.0f km²", km2, o.minKm2, o.maxKm2)
	}
	crs := "EPSG:4326"
	if planar {
		crs = "EPSG:3035"
	}
	return map[string]any{
		"crs": crs, "polygons": len(polygons), "areaKm2": math.Round(km2*10) / 10, "bbox": extent(polygons),
	}, ctx.Err()
}

// Derive keeps the file as it is. The fine tree layers of the derive unit
// project it to their own grid.
func (outline) Derive(_ context.Context, v *Version) ([]Artifact, error) {
	return originalArtifact(v, "outline"), nil
}
