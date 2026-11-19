package main

import (
	"context"
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
	body := `{"name":" Sensor Uji ","type":"device","status":"active","latitude":0,"longitude":107.6}`
	created := value[asset](t, request(t, handler, "POST", "/api/assets", body, http.StatusCreated))
	if err := original.Close(); err != nil {
		t.Fatal(err)
	}
	if created.ID == 0 || created.Name != "Sensor Uji" || created.Latitude != 0 || created.Longitude != 107.6 {
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
	invalid := `{"name":"Sensor Baru","type":"facility","status":"maintenance","latitude":90,"longitude":107.65}`
	request(t, handler, "PUT", path, invalid, http.StatusUnprocessableEntity)
	list := value[[]asset](t, request(t, handler, "GET", "/api/assets", "", http.StatusOK))
	if len(list) != 1 || list[0] != created {
		t.Fatalf("rejected update changed the asset: %+v", list)
	}

	updated := `{"name":"Sensor Baru","type":"facility","status":"maintenance","latitude":-6.94,"longitude":107.65}`
	want := asset{ID: created.ID, Name: "Sensor Baru", Type: "facility", Status: "maintenance", Latitude: -6.94, Longitude: 107.65}
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
