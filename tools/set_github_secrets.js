const fs = require("fs");
const sodium = require("libsodium-wrappers");

async function github(token, path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `token ${token}`,
      "User-Agent": "AIANKUR-SecretSetup",
      Accept: "application/vnd.github+json",
      ...(options.headers || {})
    }
  });

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    throw new Error(
      `GitHub API ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`
    );
  }
  return body;
}

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

async function putSecret({ token, owner, repo, key, keyId, name, value }) {
  const keyBytes = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
  const valueBytes = sodium.from_string(value);
  const encryptedBytes = sodium.crypto_box_seal(valueBytes, keyBytes);
  const encryptedValue = sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);

  await github(token, `/repos/${owner}/${repo}/actions/secrets/${name}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ encrypted_value: encryptedValue, key_id: keyId })
  });
}

async function main() {
  const owner = readRequiredEnv("AIANKUR_REPO_OWNER");
  const repo = readRequiredEnv("AIANKUR_REPO_NAME");
  const token = fs.readFileSync(readRequiredEnv("AIANKUR_TOKEN_FILE"), "utf8").trim();
  const cscLink = fs.readFileSync(readRequiredEnv("AIANKUR_CSC_LINK_FILE"), "utf8").trim();
  const cscPassword = fs.readFileSync(readRequiredEnv("AIANKUR_CSC_PWD_FILE"), "utf8").trim();

  await sodium.ready;

  const publicKey = await github(token, `/repos/${owner}/${repo}/actions/secrets/public-key`);
  await putSecret({
    token,
    owner,
    repo,
    key: publicKey.key,
    keyId: publicKey.key_id,
    name: "GH_TOKEN",
    value: token
  });
  await putSecret({
    token,
    owner,
    repo,
    key: publicKey.key,
    keyId: publicKey.key_id,
    name: "CSC_LINK",
    value: cscLink
  });
  await putSecret({
    token,
    owner,
    repo,
    key: publicKey.key,
    keyId: publicKey.key_id,
    name: "CSC_KEY_PASSWORD",
    value: cscPassword
  });

  const listed = await github(token, `/repos/${owner}/${repo}/actions/secrets`);
  const names = (listed.secrets || []).map((secret) => secret.name).sort();
  process.stdout.write(`SECRETS_TOTAL=${listed.total_count}\n`);
  process.stdout.write(`SECRETS_NAMES=${names.join(",")}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
