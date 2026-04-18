// Intentional credential leak demo — DO NOT use these values
// All keys below are fake but match the format of real credentials

const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";
const stripe_secret = "sk_live_51HxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
const github_token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";

// PEM private key (should never be committed)
const PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7MhgHcTz6sE2I2yPB
-----END RSA PRIVATE KEY-----`;

// Database connection with inline password
const db_url = "postgres://admin:SuperSecret123@prod-db.example.com:5432/users";

// High-entropy value assigned to api_key
const api_key = "aBcD3fGh1JkLmN0pQrStUvWxYz9876543210";

export { AWS_KEY, stripe_secret, github_token, PRIVATE_KEY, db_url, api_key };
