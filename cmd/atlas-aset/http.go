package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log"
	"math"
	"mime"
	"net/http"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

const latitudeLimit = 85.05112878

type assetInput struct {
	Name      string   `json:"name"`
	Type      string   `json:"type"`
	Status    string   `json:"status"`
	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
}

type apiError struct {
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

func newHandler(db *store) *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/assets", func(w http.ResponseWriter, r *http.Request) {
		assets, err := db.list(r.Context())
		if err != nil {
			databaseError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, assets)
	})
	mux.HandleFunc("POST /api/assets", func(w http.ResponseWriter, r *http.Request) {
		input, ok := readInput(w, r)
		if !ok {
			return
		}
		asset, err := db.create(r.Context(), input)
		if err != nil {
			databaseError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, asset)
	})
	mux.HandleFunc("PUT /api/assets/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, ok := readID(w, r)
		if !ok {
			return
		}
		input, ok := readInput(w, r)
		if !ok {
			return
		}
		asset, err := db.update(r.Context(), id, input)
		if errors.Is(err, sql.ErrNoRows) {
			notFound(w)
			return
		}
		if err != nil {
			databaseError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, asset)
	})
	mux.HandleFunc("DELETE /api/assets/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, ok := readID(w, r)
		if !ok {
			return
		}
		if err := db.delete(r.Context(), id); errors.Is(err, sql.ErrNoRows) {
			notFound(w)
			return
		} else if err != nil {
			databaseError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
	return mux
}

func readID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id < 1 {
		notFound(w)
		return 0, false
	}
	return id, true
}

func notFound(w http.ResponseWriter) {
	writeJSON(w, http.StatusNotFound, apiError{Message: "Aset tidak ditemukan. Muat ulang halaman untuk mengambil data terbaru."})
}

func readInput(w http.ResponseWriter, r *http.Request) (asset, bool) {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		writeJSON(w, http.StatusUnsupportedMediaType, apiError{Message: "Gunakan Content-Type application/json."})
		return asset{}, false
	}

	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	var input *assetInput
	if err := decoder.Decode(&input); err != nil {
		badJSON(w, err)
		return asset{}, false
	}
	if err := decoder.Decode(new(any)); err != io.EOF || input == nil {
		badJSON(w, err)
		return asset{}, false
	}

	name := strings.TrimSpace(input.Name)
	fields := map[string]string{}
	if count := utf8.RuneCountInString(name); count < 1 || count > 80 {
		fields["name"] = "Masukkan nama antara 1 dan 80 karakter."
	} else if strings.ContainsFunc(name, unicode.IsControl) {
		fields["name"] = "Hapus karakter kontrol dari nama aset."
	}
	switch input.Type {
	case "device", "vehicle", "facility":
	default:
		fields["type"] = "Pilih jenis aset yang tersedia."
	}
	switch input.Status {
	case "active", "maintenance", "inactive":
	default:
		fields["status"] = "Pilih status yang tersedia."
	}
	if !validCoordinate(input.Latitude, latitudeLimit) {
		fields["latitude"] = "Masukkan lintang antara −85,05112878 dan 85,05112878."
	}
	if !validCoordinate(input.Longitude, 180) {
		fields["longitude"] = "Masukkan bujur antara −180 dan 180."
	}
	if len(fields) != 0 {
		writeJSON(w, http.StatusUnprocessableEntity, apiError{Message: "Periksa isian aset.", Fields: fields})
		return asset{}, false
	}
	return asset{Name: name, Type: input.Type, Status: input.Status, Latitude: *input.Latitude, Longitude: *input.Longitude}, true
}

func validCoordinate(value *float64, limit float64) bool {
	return value != nil && math.Abs(*value) <= limit
}

func badJSON(w http.ResponseWriter, err error) {
	var maxBytes *http.MaxBytesError
	if errors.As(err, &maxBytes) {
		writeJSON(w, http.StatusRequestEntityTooLarge, apiError{Message: "Ukuran data aset melebihi batas."})
		return
	}
	writeJSON(w, http.StatusBadRequest, apiError{Message: "Kirim objek JSON dengan tipe data yang sesuai."})
}

func databaseError(w http.ResponseWriter, err error) {
	log.Printf("database: %v", err)
	writeJSON(w, http.StatusInternalServerError, apiError{Message: "Data aset tidak dapat diproses. Coba lagi."})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("write response: %v", err)
	}
}
