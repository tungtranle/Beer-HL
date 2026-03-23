package main

import (
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	hash := "$2a$10$LtW/gMPNJnLWDzNJCUVBduXiv96N2g5gvqbtPrOWGnL8sSgyBJWBK"
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte("demo123"))
	if err != nil {
		fmt.Println("FAIL:", err)
	} else {
		fmt.Println("OK: demo123 matches")
	}

	// Also test with the known working hash
	hash2 := "$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK"
	err2 := bcrypt.CompareHashAndPassword([]byte(hash2), []byte("demo123"))
	if err2 != nil {
		fmt.Println("FAIL hash2:", err2)
	} else {
		fmt.Println("OK: hash2 demo123 matches")
	}
}
