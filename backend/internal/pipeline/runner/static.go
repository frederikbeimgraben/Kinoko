package runner

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"path/filepath"
	"slices"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/render"
)

// staticKinds are the kinds whose active version holds static layers. A later
// kind wins a layer name: a layer that the service derives replaces an uploaded one.
var staticKinds = []sources.Kind{sources.KindStaticLayers, sources.KindTreeSpeciesMap, sources.KindDEM, sources.KindSoilGrids}

// StaticKind tells if the active version of the kind holds static layers.
func StaticKind(kind sources.Kind) bool { return slices.Contains(staticKinds, kind) }

// versionTag names a version and its last processing, so that a reprocessed version copies again.
func versionTag(v *sources.Version) string {
	tag := fmt.Sprintf("%s/v%d/%s", v.Kind, v.Number, v.ID)
	if v.ProcessedAt != nil {
		tag += "@" + v.ProcessedAt.UTC().Format(time.RFC3339Nano)
	}
	return tag
}

// staticSources gives the layer folders of the active static versions in the order of staticKinds.
// A version without layers.json, such as a tree map without an outline, gives no folder.
func staticSources(resolve sources.Resolver) ([]render.StaticSource, error) {
	var out []render.StaticSource
	for _, kind := range staticKinds {
		v, err := resolve.Active(kind, "")
		if errors.Is(err, sources.ErrMissing) {
			continue
		}
		if err != nil {
			return nil, err
		}
		if a, ok := v.Artifact(render.LayersFile); ok {
			out = append(out, render.StaticSource{Dir: filepath.Dir(a.Path), Tag: versionTag(v)})
		}
	}
	return out, nil
}

// PublishStatic copies the static layers of the active versions into Maps and adds
// their entries to layers.json. A tile folder of the same version is not copied again.
func (c *Chain) PublishStatic(log func(format string, args ...any)) error {
	srcs, err := staticSources(c.Sources.Resolver())
	if err != nil {
		return err
	}
	if len(srcs) == 0 {
		log("static layers: no active version holds static layers")
		return nil
	}
	res, err := render.InstallStaticLayers(c.Maps, srcs...)
	if err != nil {
		return fmt.Errorf("publish the static layers: %w", err)
	}
	log("static layers: copied %v, kept %v, layers.json changed: %v", res.Copied, res.Kept, res.Written)
	return nil
}

// Activated publishes the static layers after a version of a static kind becomes active.
// It waits for sources.JobLock, so it never overlaps a run or the processing of a version.
func (c *Chain) Activated(ctx context.Context, kind sources.Kind, log *slog.Logger) {
	if !StaticKind(kind) {
		return
	}
	if err := lock(ctx, &sources.JobLock); err != nil {
		return
	}
	defer sources.JobLock.Unlock()
	err := c.PublishStatic(func(format string, args ...any) {
		log.Info(fmt.Sprintf(format, args...), "kind", kind)
	})
	if err != nil {
		log.Error("publish the static layers", "kind", kind, "error", err)
	}
}
