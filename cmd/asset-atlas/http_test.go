package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func request(t *testing.T, handler http.Handler, method, path, body string, wantStatus int) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != wantStatus {
		t.Fatalf("%s %s: got %d, want %d, body %s", method, path, res.Code, wantStatus, res.Body.String())
	}
	return res
}

func value[T any](t *testing.T, result *httptest.ResponseRecorder) T {
	t.Helper()
	var decoded T
	if err := json.Unmarshal(result.Body.Bytes(), &decoded); err != nil {
		t.Fatal(err)
	}
	return decoded
}

func TestCreateAndListAfterDatabaseReopens(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "assets.db")
	open := func() *store {
		t.Helper()
		db, err := openStore(context.Background(), dbPath, false)
		if err != nil {
			t.Fatal(err)
		}
		return db
	}

	original := open()
	handler := newHandler(original)
	body := `{"name":" Test Sensor ","type":"device","status":"active","latitude":0,"longitude":107.6}`
	created := value[asset](t, request(t, handler, "POST", "/api/assets", body, http.StatusCreated))
	if err := original.Close(); err != nil {
		t.Fatal(err)
	}
	if created.ID == 0 || created.Name != "Test Sensor" || created.Latitude != 0 || created.Longitude != 107.6 {
		t.Fatalf("unexpected created asset: %+v", created)
	}

	reopened := open()
	t.Cleanup(func() { reopened.Close() })
	list := value[[]asset](t, request(t, newHandler(reopened), "GET", "/api/assets", "", http.StatusOK))
	if len(list) != 1 || list[0] != created {
		t.Fatalf("want persisted asset %+v, got %+v", created, list)
	}
}

func newTestHandler(t *testing.T) http.Handler {
	t.Helper()
	db, err := openStore(context.Background(), filepath.Join(t.TempDir(), "assets.db"), false)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return newHandler(db)
}

func TestCreateRejectsInvalidAsset(t *testing.T) {
	handler := newTestHandler(t)
	body := `{"name":" ","type":"other","status":"unknown","longitude":181}`
	res := request(t, handler, "POST", "/api/assets", body, http.StatusUnprocessableEntity)
	fields := value[apiError](t, res).Fields
	for _, field := range []string{"name", "type", "status", "latitude", "longitude"} {
		if fields[field] == "" {
			t.Errorf("expected a field error for %s, got %v", field, fields)
		}
	}

	res = request(t, handler, "GET", "/api/assets", "", http.StatusOK)
	if list := value[[]asset](t, res); list == nil || len(list) > 0 {
		t.Fatalf("want an empty JSON array, got %s", res.Body.String())
	}
}

func TestUpdateMovesAssetAndPreservesIdentity(t *testing.T) {
	handler := newTestHandler(t)
	initial := `{"name":"Sensor","type":"device","status":"active","latitude":-6.9,"longitude":107.6}`
	created := value[asset](t, request(t, handler, "POST", "/api/assets", initial, http.StatusCreated))

	path := fmt.Sprintf("/api/assets/%d", created.ID)
	invalid := `{"name":"Updated Sensor","type":"facility","status":"maintenance","latitude":90,"longitude":107.65}`
	request(t, handler, "PUT", path, invalid, http.StatusUnprocessableEntity)
	list := value[[]asset](t, request(t, handler, "GET", "/api/assets", "", http.StatusOK))
	if len(list) != 1 || list[0] != created {
		t.Fatalf("rejected update changed the asset: %+v", list)
	}

	updated := `{"name":"Updated Sensor","type":"facility","status":"maintenance","latitude":-6.94,"longitude":107.65}`
	want := asset{ID: created.ID, Name: "Updated Sensor", Type: "facility", Status: "maintenance", Latitude: -6.94, Longitude: 107.65}
	if got := value[asset](t, request(t, handler, "PUT", path, updated, http.StatusOK)); got != want {
		t.Fatalf("got %+v, want %+v", got, want)
	}
	list = value[[]asset](t, request(t, handler, "GET", "/api/assets", "", http.StatusOK))
	if len(list) != 1 || list[0] != want {
		t.Fatalf("want one updated asset, got %+v", list)
	}
	request(t, handler, "PUT", "/api/assets/999", updated, http.StatusNotFound)
}

func TestDeleteRemovesOnlyTheRequestedAsset(t *testing.T) {
	handler := newTestHandler(t)
	body := `{"name":"Unit","type":"vehicle","status":"inactive","latitude":-6.9,"longitude":107.6}`
	first := value[asset](t, request(t, handler, "POST", "/api/assets", body, http.StatusCreated))
	second := value[asset](t, request(t, handler, "POST", "/api/assets", body, http.StatusCreated))
	path := fmt.Sprintf("/api/assets/%d", first.ID)

	res := request(t, handler, "DELETE", path, "", http.StatusNoContent)
	if res.Body.Len() != 0 {
		t.Fatalf("want no response body, got %q", res.Body.String())
	}
	request(t, handler, "DELETE", path, "", http.StatusNotFound)
	request(t, handler, "DELETE", "/api/assets/invalid", "", http.StatusNotFound)

	list := value[[]asset](t, request(t, handler, "GET", "/api/assets", "", http.StatusOK))
	if len(list) != 1 || list[0] != second {
		t.Fatalf("want only the other asset %+v, got %+v", second, list)
	}
}

func TestLocationDetailsAPI(t *testing.T) {
	handler := newTestHandler(t)
	initial := `{"name":"Sensor","type":"device","status":"active","latitude":-6.9,"longitude":107.6,"district":" Coblong ","city":"Bandung","province":"West Java"}`
	created := value[map[string]any](t, request(t, handler, "POST", "/api/assets", initial, http.StatusCreated))
	if created["district"] != "Coblong" || created["city"] != "Bandung" || created["province"] != "West Java" {
		t.Fatalf("unexpected location details: %v", created)
	}
	path := fmt.Sprintf("/api/assets/%.0f", created["id"])

	clearDistrict := `{"name":"Sensor","type":"device","status":"maintenance","latitude":-6.9,"longitude":107.6,"district":""}`
	updated := value[map[string]any](t, request(t, handler, "PUT", path, clearDistrict, http.StatusOK))
	if updated["district"] != "" || updated["city"] != "Bandung" || updated["province"] != "West Java" {
		t.Fatalf("unexpected location details after clearing district: %v", updated)
	}
	list := value[[]map[string]any](t, request(t, handler, "GET", "/api/assets", "", http.StatusOK))
	if len(list) != 1 || list[0]["city"] != "Bandung" || list[0]["province"] != "West Java" {
		t.Fatalf("unexpected persisted location details: %v", list)
	}

	move := `{"name":"Sensor","type":"device","status":"maintenance","latitude":-7,"longitude":107.6}`
	moved := value[map[string]any](t, request(t, handler, "PUT", path, move, http.StatusOK))
	if moved["district"] != "" || moved["city"] != "" || moved["province"] != "" {
		t.Fatalf("old location details carried to a different point: %v", moved)
	}

	invalid := `{"name":"Sensor","type":"device","status":"active","latitude":0,"longitude":0,"city":"A\nB"}`
	res := request(t, handler, "POST", "/api/assets", invalid, http.StatusUnprocessableEntity)
	if value[apiError](t, res).Fields["city"] == "" {
		t.Fatal("expected a field error for city")
	}
}

func TestVersionOneDatabaseKeepsExistingAssets(t *testing.T) {
	path := filepath.Join(t.TempDir(), "legacy.db")
	legacy, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	_, err = legacy.Exec(`
		CREATE TABLE assets (
			id INTEGER PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
			status TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL
		);
		INSERT INTO assets VALUES (7, 'Existing Sensor', 'device', 'inactive', -6.9, 107.6);
		PRAGMA user_version = 1;
	`)
	closeErr := legacy.Close()
	if err != nil {
		t.Fatal(err)
	}
	if closeErr != nil {
		t.Fatal(closeErr)
	}

	for range 2 {
		db, err := openStore(context.Background(), path, false)
		if err != nil {
			t.Fatal(err)
		}
		list := value[[]map[string]any](t, request(t, newHandler(db), "GET", "/api/assets", "", http.StatusOK))
		if err := db.Close(); err != nil {
			t.Fatal(err)
		}
		if len(list) != 1 || list[0]["id"] != float64(7) || list[0]["name"] != "Existing Sensor" ||
			list[0]["status"] != "inactive" || list[0]["latitude"] != -6.9 || list[0]["longitude"] != 107.6 ||
			list[0]["district"] != "" || list[0]["city"] != "" || list[0]["province"] != "" {
			t.Fatalf("unexpected assets after migrating: %v", list)
		}
	}
}
