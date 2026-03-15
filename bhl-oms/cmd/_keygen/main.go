package main
import ("crypto/rand";"crypto/rsa";"crypto/x509";"encoding/pem";"os")
func main() {
    key, _ := rsa.GenerateKey(rand.Reader, 2048)
    privFile, _ := os.Create("keys/private.pem")
    pem.Encode(privFile, &pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})
    privFile.Close()
    pubBytes, _ := x509.MarshalPKIXPublicKey(&key.PublicKey)
    pubFile, _ := os.Create("keys/public.pem")
    pem.Encode(pubFile, &pem.Block{Type: "PUBLIC KEY", Bytes: pubBytes})
    pubFile.Close()
}
