package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:8080", "HTTP listen address")
	path := flag.String("db", "data/assets.db", "SQLite database file")
	seed := flag.Bool("seed", false, "insert sample assets in a new database")
	web := flag.String("web", "web/dist", "directory containing the built web app")
	flag.Parse()

	if err := run(*addr, *path, *web, *seed); err != nil {
		log.Fatal(err)
	}
}

func run(addr, path, web string, seed bool) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	db, err := openStore(context.Background(), path, seed)
	if err != nil {
		return err
	}
	defer db.Close()

	handler := newHandler(db)
	if web != "" {
		handler.Handle("GET /", http.FileServer(http.Dir(web)))
	}
	server := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	serve := make(chan error, 1)
	go func() {
		log.Printf("Atlas Aset listening on http://%s", addr)
		serve <- server.ListenAndServe()
	}()
	select {
	case err := <-serve:
		return err
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdown); err != nil && !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	}
}
