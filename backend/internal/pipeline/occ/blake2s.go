package occ

import (
	"encoding/binary"
	"encoding/hex"
	"math/bits"
)

// blake2sIV is the initial value of BLAKE2s (RFC 7693, section 2.6).
var blake2sIV = [8]uint32{
	0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
	0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19,
}

// blake2sSigma is the message schedule of BLAKE2s (RFC 7693, section 2.7).
var blake2sSigma = [10][16]byte{
	{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15},
	{14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3},
	{11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4},
	{7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8},
	{9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13},
	{2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9},
	{12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11},
	{13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10},
	{6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5},
	{10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0},
}

// Blake2s gives the unkeyed BLAKE2s digest of msg with size bytes (1..32), as
// hashlib.blake2s(msg, digest_size=size). The size goes into the parameter
// block, so a short digest is not a prefix of the 32-byte one; x/crypto has only 32 bytes.
func Blake2s(msg []byte, size int) []byte {
	if size < 1 || size > 32 {
		panic("occ: blake2s digest size must be 1..32")
	}
	h := blake2sIV
	h[0] ^= 0x01010000 ^ uint32(size)
	var t uint64
	for len(msg) > 64 {
		t += 64
		blake2sCompress(&h, msg[:64], t, false)
		msg = msg[64:]
	}
	var last [64]byte
	copy(last[:], msg)
	t += uint64(len(msg))
	blake2sCompress(&h, last[:], t, true)
	out := make([]byte, 32)
	for i, v := range h {
		binary.LittleEndian.PutUint32(out[4*i:], v)
	}
	return out[:size]
}

func blake2sCompress(h *[8]uint32, block []byte, t uint64, final bool) {
	var m [16]uint32
	for i := range m {
		m[i] = binary.LittleEndian.Uint32(block[4*i:])
	}
	var v [16]uint32
	copy(v[:8], h[:])
	copy(v[8:], blake2sIV[:])
	v[12] ^= uint32(t)
	v[13] ^= uint32(t >> 32)
	if final {
		v[14] = ^v[14]
	}
	g := func(a, b, c, d int, x, y uint32) {
		v[a] = v[a] + v[b] + x
		v[d] = bits.RotateLeft32(v[d]^v[a], -16)
		v[c] += v[d]
		v[b] = bits.RotateLeft32(v[b]^v[c], -12)
		v[a] = v[a] + v[b] + y
		v[d] = bits.RotateLeft32(v[d]^v[a], -8)
		v[c] += v[d]
		v[b] = bits.RotateLeft32(v[b]^v[c], -7)
	}
	for _, s := range blake2sSigma {
		g(0, 4, 8, 12, m[s[0]], m[s[1]])
		g(1, 5, 9, 13, m[s[2]], m[s[3]])
		g(2, 6, 10, 14, m[s[4]], m[s[5]])
		g(3, 7, 11, 15, m[s[6]], m[s[7]])
		g(0, 5, 10, 15, m[s[8]], m[s[9]])
		g(1, 6, 11, 12, m[s[10]], m[s[11]])
		g(2, 7, 8, 13, m[s[12]], m[s[13]])
		g(3, 4, 9, 14, m[s[14]], m[s[15]])
	}
	for i := range h {
		h[i] ^= v[i] ^ v[i+8]
	}
}

// AppObserver gives the observer of an app find: "app:" and the 8-byte BLAKE2s of the find id.
// One find is one observer-day, because the endpoint gives no account.
func AppObserver(findID string) string {
	return "app:" + hex.EncodeToString(Blake2s([]byte(findID), 8))
}
