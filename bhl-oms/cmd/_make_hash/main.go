package main

import (
"fmt"
"golang.org/x/crypto/bcrypt"
)

func main() {
hash, err := bcrypt.GenerateFromPassword([]byte("demo123"), bcrypt.DefaultCost)
if err != nil {
panic(err)
}
fmt.Println(string(hash))
}
