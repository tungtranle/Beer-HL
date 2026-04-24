package main

import (
"fmt"
"golang.org/x/crypto/bcrypt"
)

func main() {
hash := "$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2"
err := bcrypt.CompareHashAndPassword([]byte(hash), []byte("demo123"))
if err != nil {
fmt.Println("FAIL:", err)
} else {
fmt.Println("OK: hash matches demo123")
}
}
