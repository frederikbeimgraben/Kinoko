package tiles

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	"image/draw"
	"image/png"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
)

// TileFile returns <root>/<z>/<x>/<y>.png, as pyramid.tile_file.
func TileFile(root string, id geo.TileID) string {
	return filepath.Join(root, strconv.Itoa(id.Z), strconv.Itoa(id.X), strconv.Itoa(id.Y)+".png")
}

// EncodePNG codes one tile as an 8-bit greyscale PNG.
func EncodePNG(code []uint8) ([]byte, error) {
	if len(code) != TileSize*TileSize {
		return nil, fmt.Errorf("tiles: tile has %d points, want %d", len(code), TileSize*TileSize)
	}
	img := &image.Gray{Pix: code, Stride: TileSize, Rect: image.Rect(0, 0, TileSize, TileSize)}
	var buf bytes.Buffer
	enc := png.Encoder{CompressionLevel: png.BestCompression}
	if err := enc.Encode(&buf, img); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// DecodePNG reads a tile as greyscale bytes. Go's grey model converts a colour
// PNG; it can differ by one step from PIL "L", but the chain writes only grey tiles.
func DecodePNG(data []byte) ([]uint8, error) {
	img, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	if g, ok := img.(*image.Gray); ok && g.Stride == g.Rect.Dx() {
		return g.Pix, nil
	}
	g := image.NewGray(image.Rect(0, 0, img.Bounds().Dx(), img.Bounds().Dy()))
	draw.Draw(g, g.Rect, img, img.Bounds().Min, draw.Src)
	return g.Pix, nil
}

// WriteTile writes one tile as pyramid.write_tile. A tile without data
// writes nothing and returns false.
func WriteTile(root string, id geo.TileID, code []uint8) (bool, error) {
	if !HasData(code) {
		return false, nil
	}
	data, err := EncodePNG(code)
	if err != nil {
		return false, err
	}
	path := TileFile(root, id)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return false, err
	}
	return true, os.WriteFile(path, data, 0o644)
}

// ReadTile reads one tile, or returns nil when the file does not exist.
func ReadTile(root string, id geo.TileID) ([]uint8, error) {
	data, err := os.ReadFile(TileFile(root, id))
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return DecodePNG(data)
}

// WritePyramid writes the tiles of p under root and returns the bytes on
// disk, as render_field. It writes to root.tmp and then replaces root, so a
// reader never sees half a week.
func WritePyramid(root string, p Pyramid) (int64, error) {
	tmp := root + ".tmp"
	if err := os.RemoveAll(tmp); err != nil {
		return 0, err
	}
	var size int64
	for _, id := range p.Filled {
		data, err := EncodePNG(p.Tiles[id].Code)
		if err != nil {
			return 0, err
		}
		path := TileFile(tmp, id)
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return 0, err
		}
		if err := os.WriteFile(path, data, 0o644); err != nil {
			return 0, err
		}
		size += int64(len(data))
	}
	if err := os.MkdirAll(tmp, 0o755); err != nil {
		return 0, err
	}
	if err := os.RemoveAll(root); err != nil {
		return 0, err
	}
	if err := os.MkdirAll(filepath.Dir(root), 0o755); err != nil {
		return 0, err
	}
	return size, os.Rename(tmp, root)
}

// DirStore is a Store on disk: the value tree under Root and the weight tree
// under Weights, as the block loop of fine_layers.py. It suits pyramids that
// do not fit in memory.
type DirStore struct{ Root, Weights string }

// At lists the value tiles of one zoom, as pyramid.tiles_at.
func (d DirStore) At(zoom int) ([]geo.TileID, error) {
	folder := filepath.Join(d.Root, strconv.Itoa(zoom))
	cols, err := os.ReadDir(folder)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var out []geo.TileID
	for _, col := range cols {
		x, err := strconv.Atoi(col.Name())
		if !col.IsDir() || err != nil || !isDigits(col.Name()) {
			continue
		}
		files, err := os.ReadDir(filepath.Join(folder, col.Name()))
		if err != nil {
			return nil, err
		}
		for _, f := range files {
			stem, ok := strings.CutSuffix(f.Name(), ".png")
			if y, err := strconv.Atoi(stem); ok && err == nil && isDigits(stem) {
				out = append(out, geo.TileID{Z: zoom, X: x, Y: y})
			}
		}
	}
	return out, nil
}

func isDigits(s string) bool {
	return s != "" && strings.Trim(s, "0123456789") == ""
}

// Get reads the value and the weight tile. A missing weight tile is all 0.
func (d DirStore) Get(id geo.TileID) (*Tile, error) {
	code, err := ReadTile(d.Root, id)
	if err != nil || code == nil {
		return nil, err
	}
	weight, err := ReadTile(d.Weights, id)
	if err != nil {
		return nil, err
	}
	if weight == nil {
		weight = make([]uint8, len(code))
	}
	return &Tile{Code: code, Weight: weight}, nil
}

// Put writes the weight tile and the value tile.
func (d DirStore) Put(id geo.TileID, t Tile) error {
	if _, err := WriteTile(d.Weights, id, t.Weight); err != nil {
		return err
	}
	_, err := WriteTile(d.Root, id, t.Code)
	return err
}
