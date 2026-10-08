package pyjson

import (
	"math"
	"strconv"
	"strings"
)

// PyFloat formats f as Python repr(float): the shortest digits that read back as f, in exponent
// form when the exponent is < -4 or >= 16 ("1e-05"), else in fixed form with one decimal or more
// ("1.0"). NaN and the infinities give "NaN", "Infinity" and "-Infinity", as json.dumps.
func PyFloat(f float64) string {
	switch {
	case math.IsNaN(f):
		return "NaN"
	case math.IsInf(f, 1):
		return "Infinity"
	case math.IsInf(f, -1):
		return "-Infinity"
	case f == 0 && math.Signbit(f):
		return "-0.0"
	case f == 0:
		return "0.0"
	}
	sign := ""
	if f < 0 {
		sign, f = "-", -f
	}
	mant, expText, _ := strings.Cut(strconv.FormatFloat(f, 'e', -1, 64), "e")
	exp, _ := strconv.Atoi(expText)
	digits := strings.Replace(mant, ".", "", 1)
	if exp < -4 || exp >= 16 {
		return sign + sciForm(digits, exp)
	}
	return sign + fixedForm(digits, exp+1)
}

func sciForm(digits string, exp int) string {
	expSign := "+"
	if exp < 0 {
		expSign, exp = "-", -exp
	}
	expDigits := strconv.Itoa(exp)
	if len(expDigits) < 2 {
		expDigits = "0" + expDigits
	}
	mant := digits[:1]
	if len(digits) > 1 {
		mant += "." + digits[1:]
	}
	return mant + "e" + expSign + expDigits
}

// fixedForm places the decimal point after decpt digits.
func fixedForm(digits string, decpt int) string {
	switch {
	case decpt <= 0:
		return "0." + strings.Repeat("0", -decpt) + digits
	case decpt >= len(digits):
		return digits + strings.Repeat("0", decpt-len(digits)) + ".0"
	default:
		return digits[:decpt] + "." + digits[decpt:]
	}
}

// Round returns x rounded to nd decimals, as Python round(x, nd) with nd >= 0.
// It rounds the exact binary value of x, half to even. A negative nd counts as 0.
func Round(x float64, nd int) float64 {
	if math.IsNaN(x) || math.IsInf(x, 0) {
		return x
	}
	r, err := strconv.ParseFloat(strconv.FormatFloat(x, 'f', max(nd, 0), 64), 64)
	if err != nil {
		return x
	}
	return r
}
