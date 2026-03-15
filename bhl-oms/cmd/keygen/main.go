package main

import (
    "crypto/rand"
    "crypto/rsa"
    "crypto/x509"
    "encoding/pem"
    "os"
    "fmt"
)

func main() {
    key, err := rsa.GenerateKey(rand.Reader, 2048)
    if err != nil { fmt.Println(err); os.Exit(1) }
    privFile, _ := os.Create("keys/private.pem")
    pem.Encode(privFile, &pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})
    privFile.Close()
    pubBytes, _ := x509.MarshalPKIXPublicKey(key.Public())
    pubFile, _ := os.Create("keys/public.pem")
    pem.Encode(pubFile, &pem.Block{Type: "PUBLIC KEY", Bytes: pubBytes})
    pubFile.Close()
    fmt.Println("Done")
}
