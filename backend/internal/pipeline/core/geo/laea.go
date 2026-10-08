// Package geo holds the projections and the tile grid of the chain: LAEA
// (EPSG:3035), spherical web mercator, the XYZ tile maths, the byte coding of
// a value tile and the keys of grid cells.
package geo

import "math"

// GRS80 and the parameters of EPSG:3035, as PROJ defines them.
const (
	grs80A   = 6378137.0
	grs80Inv = 298.257222101
	laeaLat0 = 52.0
	laeaLon0 = 10.0
	laeaX0   = 4321000.0
	laeaY0   = 3210000.0
	degToRad = math.Pi / 180.0
	radToDeg = 180.0 / math.Pi
)

// laeaParams holds the constants of the oblique ellipsoidal LAEA (PROJ laea.cpp, setup).
type laeaParams struct {
	e, es, oneEs, qp, rq, dd, xmf, ymf, sinb1, cosb1 float64
}

var laea = newLaea()

func newLaea() laeaParams {
	f := 1 / grs80Inv
	es := 2*f - f*f
	e := math.Sqrt(es)
	oneEs := 1 - es
	qp := qsfn(1, e, oneEs)
	rq := math.Sqrt(0.5 * qp)
	sinphi := math.Sin(laeaLat0 * degToRad)
	sinb1 := qsfn(sinphi, e, oneEs) / qp
	cosb1 := math.Sqrt(1 - sinb1*sinb1)
	dd := math.Cos(laeaLat0*degToRad) / (math.Sqrt(1-es*sinphi*sinphi) * rq * cosb1)
	return laeaParams{e: e, es: es, oneEs: oneEs, qp: qp, rq: rq, dd: dd,
		xmf: rq * dd, ymf: rq / dd, sinb1: sinb1, cosb1: cosb1}
}

// qsfn is q(phi) of Snyder (3-12), as pj_qsfn.
func qsfn(sinphi, e, oneEs float64) float64 {
	con := e * sinphi
	return oneEs * (sinphi/(1-con*con) - (0.5/e)*math.Log((1-con)/(1+con)))
}

// LAEA3035 projects a point in degrees (ETRS89, taken as WGS84) to EPSG:3035
// metres, as pyproj Transformer("EPSG:4326", "EPSG:3035", always_xy=True).
func LAEA3035(lon, lat float64) (x, y float64) {
	p := laea
	lam := (lon - laeaLon0) * degToRad
	sinb := qsfn(math.Sin(lat*degToRad), p.e, p.oneEs) / p.qp
	cosb := math.Sqrt(1 - sinb*sinb)
	coslam, sinlam := math.Cos(lam), math.Sin(lam)
	b := math.Sqrt(2 / (1 + p.sinb1*sinb + p.cosb1*cosb*coslam))
	x = p.xmf * b * cosb * sinlam
	y = p.ymf * b * (p.cosb1*sinb - p.sinb1*cosb*coslam)
	return grs80A*x + laeaX0, grs80A*y + laeaY0
}

// InvLAEA3035 returns the point in degrees of EPSG:3035 metres x, y.
// It solves the authalic latitude with Newton steps, not with the PROJ series.
func InvLAEA3035(x, y float64) (lon, lat float64) {
	p := laea
	px := (x - laeaX0) / grs80A / p.dd
	py := (y - laeaY0) / grs80A * p.dd
	rho := math.Hypot(px, py)
	if rho < 1e-10 {
		return laeaLon0, laeaLat0
	}
	ce := 2 * math.Asin(0.5*rho/p.rq)
	sCe, cCe := math.Sin(ce), math.Cos(ce)
	sinBeta := cCe*p.sinb1 + py*sCe*p.cosb1/rho
	lam := math.Atan2(px*sCe, rho*p.cosb1*cCe-py*p.sinb1*sCe)
	return lam*radToDeg + laeaLon0, authalicToGeodetic(sinBeta) * radToDeg
}

// authalicToGeodetic solves q(phi) = qp*sin(beta) for phi (Snyder 3-16).
func authalicToGeodetic(sinBeta float64) float64 {
	p := laea
	q := p.qp * sinBeta
	phi := math.Asin(q / 2)
	for range 20 {
		s, c := math.Sin(phi), math.Cos(phi)
		if math.Abs(c) < 1e-12 {
			return phi
		}
		con := p.e * s
		one := 1 - con*con
		step := one * one / (2 * c) * (q/p.oneEs - s/one + math.Log((1-con)/(1+con))/(2*p.e))
		phi += step
		if math.Abs(step) < 1e-15 {
			break
		}
	}
	return phi
}
