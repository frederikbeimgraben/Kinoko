package sources_test

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
)

func TestAddFileInstallsAndActivatesAFetchedFile(t *testing.T) {
	f := newFixture(t)
	f.m.UseProcessor(sources.KindDEM, acceptAll{})
	ctx := context.Background()
	if wanted, err := f.m.Wanted(ctx, sources.KindDEM); err != nil || !wanted {
		t.Fatalf("Wanted = %v, %v before the first version", wanted, err)
	}
	file := filepath.Join(t.TempDir(), "dem.zip")
	if err := os.WriteFile(file, []byte("PK tiles"), 0o600); err != nil {
		t.Fatal(err)
	}

	sources.JobLock.Lock()
	v, err := f.m.AddFile(ctx, sources.KindDEM, file, "dem.zip")
	sources.JobLock.Unlock()

	if err != nil {
		t.Fatal(err)
	}
	if v.State != sources.StateReady || !v.Active || v.Origin != sources.OriginUpload || v.CreatedByID != nil {
		t.Fatalf("version = %+v", v)
	}
	if got, err := os.ReadFile(v.Original()); err != nil || string(got) != "PK tiles" {
		t.Fatalf("original = %q, %v", got, err)
	}
	if _, err := os.Stat(file); !os.IsNotExist(err) {
		t.Errorf("the fetched file is still there: %v", err)
	}
	if wanted, err := f.m.Wanted(ctx, sources.KindDEM); err != nil || wanted {
		t.Fatalf("Wanted = %v, %v with an active version", wanted, err)
	}
}

func TestAddFileReportsAFailedCheckInTheVersion(t *testing.T) {
	f := newFixture(t)
	f.m.UseProcessor(sources.KindSoilGrids, nil)
	file := filepath.Join(t.TempDir(), "soilgrids.zip")
	if err := os.WriteFile(file, []byte("PK"), 0o600); err != nil {
		t.Fatal(err)
	}
	sources.JobLock.Lock()
	v, err := f.m.AddFile(context.Background(), sources.KindSoilGrids, file, "soilgrids.zip")
	sources.JobLock.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	if v.State != sources.StateFailed || v.Active || v.ErrorCode == nil || *v.ErrorCode != "processor_missing" {
		t.Fatalf("version = %+v", v)
	}
	if wanted, _ := f.m.Wanted(context.Background(), sources.KindSoilGrids); !wanted {
		t.Error("a failed version must not stop the next fetch")
	}
}

func TestAddFileRefusesAWrongExtension(t *testing.T) {
	f := newFixture(t)
	if _, err := f.m.AddFile(context.Background(), sources.KindSoilGrids, "x", "soil.tif"); err == nil {
		t.Fatal("AddFile took a .tif for soilgrids")
	}
}
