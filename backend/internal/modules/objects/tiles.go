package objects

import (
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"maps"
	"math"
	"os"
	"path/filepath"
	"slices"
	"strconv"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

const (
	// tileSize is the edge of a value tile in pixels.
	tileSize = 256
	// steps is the count of value tiers above zero. Tier zero means no data.
	steps   = 254
	percent = 100
)

// weekTiles is one week of the manifest with the path to its tiles.
type weekTiles struct {
	Year  int
	Week  int
	Tiles string
}

// manifest is the manifest of a species under the maps folder.
type manifest struct {
	Name  string
	Top   float64
	Weeks []weekTiles
	Have  map[int][]string
}

type rawManifest struct {
	Name  *string   `json:"name"`
	Top   *laxFloat `json:"top"`
	Weeks *[]struct {
		Year  *laxInt `json:"year"`
		Week  *laxInt `json:"week"`
		Tiles *string `json:"tiles"`
	} `json:"weeks"`
	Tiles *struct {
		Have *map[string][]string `json:"have"`
	} `json:"tiles"`
}

// readManifest reads the manifest of a map. A missing or broken file gives false.
func readManifest(maps, name string) (manifest, bool) {
	file := filepath.Join(maps, name+".json")
	if !isFile(file) {
		return manifest{}, false
	}
	data, err := os.ReadFile(file)
	if err != nil {
		return manifest{}, false
	}
	return parseManifest(data)
}

func parseManifest(data []byte) (manifest, bool) {
	var raw rawManifest
	if err := json.Unmarshal(data, &raw); err != nil {
		return manifest{}, false
	}
	if raw.Name == nil || raw.Top == nil || raw.Weeks == nil || raw.Tiles == nil || raw.Tiles.Have == nil {
		return manifest{}, false
	}
	weeks := make([]weekTiles, 0, len(*raw.Weeks))
	for _, w := range *raw.Weeks {
		if w.Year == nil || w.Week == nil || w.Tiles == nil {
			return manifest{}, false
		}
		weeks = append(weeks, weekTiles{Year: int(*w.Year), Week: int(*w.Week), Tiles: *w.Tiles})
	}
	have := map[int][]string{}
	for key, names := range *raw.Tiles.Have {
		zoom, err := strconv.Atoi(key)
		if err != nil {
			return manifest{}, false
		}
		have[zoom] = names
	}
	return manifest{Name: *raw.Name, Top: float64(*raw.Top), Weeks: weeks, Have: have}, true
}

// findWeek gives the first entry of the week.
func findWeek(m manifest, year, week int) (weekTiles, bool) {
	return fn.Find(m.Weeks, func(w weekTiles) bool { return w.Year == year && w.Week == week })
}

// toWorldPoint converts degrees to pixels of the world map (Web Mercator).
func toWorldPoint(p geo.Point, zoom int) (float64, float64) {
	radian := geo.Radians(p.Lat)
	edge := float64(int(tileSize) << zoom)
	x := (p.Lon + 180.0) / 360.0 * edge
	y := (1 - math.Log(math.Tan(radian)+1/geo.Cos(radian))/math.Pi) / 2 * edge
	return x, y
}

// toDegrees converts pixels of the world map back to degrees.
func toDegrees(x, y float64, zoom int) geo.Point {
	edge := float64(int(tileSize) << zoom)
	lon := x/edge*360.0 - 180.0
	lat := geo.Degrees(math.Atan(math.Sinh(math.Pi * (1 - 2*y/edge))))
	return geo.Point{Lon: lon, Lat: lat}
}

// cell is a pixel of a tile: which tile, and where in it.
type cell struct {
	TileX, TileY, X, Y int
}

func floorDiv(a, b int) int {
	q := a / b
	if a%b != 0 && (a < 0) != (b < 0) {
		q--
	}
	return q
}

func cellOf(worldX, worldY int) cell {
	tx, ty := floorDiv(worldX, tileSize), floorDiv(worldY, tileSize)
	return cell{TileX: tx, TileY: ty, X: worldX - tx*tileSize, Y: worldY - ty*tileSize}
}

// cellsUnder gives the pixels whose centre is in the ring. A zone smaller
// than a pixel gets the pixel under its centroid.
func cellsUnder(ring geo.Ring, zoom int) []cell {
	box := geo.Bounds(ring)
	left, top := toWorldPoint(geo.Point{Lon: box.West, Lat: box.North}, zoom)
	right, bottom := toWorldPoint(geo.Point{Lon: box.East, Lat: box.South}, zoom)
	found := []cell{}
	for wy := int(top); wy <= int(bottom); wy++ {
		for wx := int(left); wx <= int(right); wx++ {
			if geo.Inside(toDegrees(float64(wx)+0.5, float64(wy)+0.5, zoom), ring) {
				found = append(found, cellOf(wx, wy))
			}
		}
	}
	if len(found) == 0 {
		cx, cy := toWorldPoint(geo.Centroid(ring), zoom)
		found = append(found, cellOf(int(cx), int(cy)))
	}
	return found
}

type tileKey struct{ x, y int }

type tileGroup struct {
	key   tileKey
	cells []cell
}

// byTile groups the cells by tile, in the order of the first cell of each tile.
func byTile(cells []cell) []tileGroup {
	return fn.Reduce(cells, []tileGroup{}, func(acc []tileGroup, c cell) []tileGroup {
		key := tileKey{c.TileX, c.TileY}
		if i := slices.IndexFunc(acc, func(g tileGroup) bool { return g.key == key }); i >= 0 {
			acc[i].cells = append(acc[i].cells, c)
			return acc
		}
		return append(acc, tileGroup{key: key, cells: []cell{c}})
	})
}

// luma gives the grey value of a pixel as Pillow convert("L") does.
func luma(img image.Image, x, y int) uint8 {
	switch typed := img.(type) {
	case *image.Gray:
		return typed.GrayAt(x, y).Y
	case *image.Gray16:
		return uint8(min(typed.Gray16At(x, y).Y, 255))
	}
	c := color.NRGBAModel.Convert(img.At(x, y)).(color.NRGBA)
	return uint8((19595*uint32(c.R) + 38470*uint32(c.G) + 7471*uint32(c.B) + 0x8000) >> 16)
}

// tileSum adds the tiers of the cells of one tile. Tier zero adds nothing.
func tileSum(file string, cells []cell) (float64, int, error) {
	handle, err := os.Open(file)
	if err != nil {
		return 0, 0, err
	}
	defer func() { _ = handle.Close() }()
	img, err := png.Decode(handle)
	if err != nil {
		return 0, 0, fmt.Errorf("tile %s: %w", file, err)
	}
	total, points := 0.0, 0
	for _, c := range cells {
		at := image.Point{X: img.Bounds().Min.X + c.X, Y: img.Bounds().Min.Y + c.Y}
		if !at.In(img.Bounds()) {
			return 0, 0, fmt.Errorf("tile %s: pixel %d/%d out of range", file, c.X, c.Y)
		}
		if tier := luma(img, at.X, at.Y); tier > 0 {
			total += float64(tier-1) / steps
			points++
		}
	}
	return total, points, nil
}

// areaMean gives the mean of the value tiles under the ring, in percent of
// the top value, and the count of pixels with data.
func areaMean(folder string, m manifest, tilePath string, ring geo.Ring) (float64, int, error) {
	if len(m.Have) == 0 || len(ring) == 0 {
		return 0, 0, nil
	}
	zoom := slices.Max(slices.Collect(maps.Keys(m.Have)))
	present := fn.Set(m.Have[zoom])
	total, points := 0.0, 0
	for _, group := range byTile(cellsUnder(ring, zoom)) {
		name := fmt.Sprintf("%d/%d", group.key.x, group.key.y)
		file := filepath.Join(folder, tilePath, strconv.Itoa(zoom), strconv.Itoa(group.key.x), strconv.Itoa(group.key.y)+".png")
		if _, ok := present[name]; !ok || !isFile(file) {
			continue
		}
		part, found, err := tileSum(file, group.cells)
		if err != nil {
			return 0, 0, err
		}
		total += part
		points += found
	}
	if points == 0 {
		return 0, 0, nil
	}
	return total / float64(points) * m.Top * percent, points, nil
}
