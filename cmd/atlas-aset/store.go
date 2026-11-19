package main

import (
	"context"
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite"
)

type asset struct {
	ID        int64   `json:"id"`
	Name      string  `json:"name"`
	Type      string  `json:"type"`
	Status    string  `json:"status"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type store struct {
	*sql.DB
}

func openStore(ctx context.Context, path string, seed bool) (*store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	result := &store{db}
	if err := result.initialize(ctx, seed); err != nil {
		db.Close()
		return nil, err
	}
	return result, nil
}

func (db *store) initialize(ctx context.Context, seed bool) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var version int
	if err := tx.QueryRowContext(ctx, "PRAGMA user_version").Scan(&version); err != nil {
		return err
	}
	switch version {
	case 1:
		return tx.Commit()
	case 0:
	default:
		return fmt.Errorf("unsupported database version %d", version)
	}

	_, err = tx.ExecContext(ctx, `
		CREATE TABLE assets (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
			type TEXT NOT NULL CHECK(type IN ('device', 'vehicle', 'facility')),
			status TEXT NOT NULL CHECK(status IN ('active', 'maintenance', 'inactive')),
			latitude REAL NOT NULL CHECK(latitude BETWEEN -85.05112878 AND 85.05112878),
			longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180)
		)
	`)
	if err != nil {
		return err
	}
	if seed {
		_, err = tx.ExecContext(ctx, `
			INSERT INTO assets (name, type, status, latitude, longitude) VALUES
				('Sensor Braga', 'device', 'active', -6.9172, 107.6099),
				('Unit Operasional 02', 'vehicle', 'active', -6.9098, 107.6368),
				('Stasiun Cikapundung', 'facility', 'maintenance', -6.8906, 107.5989),
				('Gateway Dago', 'device', 'active', -6.8818, 107.6151),
				('Unit Operasional 04', 'vehicle', 'inactive', -6.9299, 107.6266),
				('Pos Pemantauan Timur', 'facility', 'active', -6.9137, 107.6510)
		`)
		if err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, "PRAGMA user_version = 1"); err != nil {
		return err
	}
	return tx.Commit()
}

type scanner interface {
	Scan(dest ...any) error
}

func readAsset(row scanner) (asset, error) {
	var result asset
	err := row.Scan(&result.ID, &result.Name, &result.Type, &result.Status, &result.Latitude, &result.Longitude)
	return result, err
}

func (db *store) list(ctx context.Context) ([]asset, error) {
	rows, err := db.QueryContext(ctx, "SELECT id, name, type, status, latitude, longitude FROM assets ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []asset{}
	for rows.Next() {
		item, err := readAsset(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (db *store) create(ctx context.Context, input asset) (asset, error) {
	row := db.QueryRowContext(ctx, `
		INSERT INTO assets (name, type, status, latitude, longitude) VALUES (?, ?, ?, ?, ?)
		RETURNING id, name, type, status, latitude, longitude
	`, input.Name, input.Type, input.Status, input.Latitude, input.Longitude)
	return readAsset(row)
}

func (db *store) update(ctx context.Context, id int64, input asset) (asset, error) {
	row := db.QueryRowContext(ctx, `
		UPDATE assets SET name = ?, type = ?, status = ?, latitude = ?, longitude = ?
		WHERE id = ?
		RETURNING id, name, type, status, latitude, longitude
	`, input.Name, input.Type, input.Status, input.Latitude, input.Longitude, id)
	return readAsset(row)
}

func (db *store) delete(ctx context.Context, id int64) error {
	result, err := db.ExecContext(ctx, "DELETE FROM assets WHERE id = ?", id)
	if err != nil {
		return err
	}
	count, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if count == 0 {
		return sql.ErrNoRows
	}
	return nil
}
