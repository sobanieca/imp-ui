use anyhow::Result;
use std::time::Duration;

pub struct Fetched {
    pub status: u16,
    pub body: Vec<u8>,
}

impl Fetched {
    pub fn ok(&self) -> bool {
        (200..300).contains(&self.status)
    }

    pub fn text(&self) -> String {
        String::from_utf8_lossy(&self.body).into_owned()
    }

    pub fn json(&self) -> Result<serde_json::Value> {
        Ok(serde_json::from_slice(&self.body)?)
    }
}

fn agent(timeout: Option<Duration>) -> ureq::Agent {
    ureq::Agent::config_builder()
        .http_status_as_error(false)
        .timeout_global(timeout)
        .user_agent(format!("imp/{}", crate::version::VERSION))
        .tls_config(
            ureq::tls::TlsConfig::builder().root_certs(ureq::tls::RootCerts::PlatformVerifier).build(),
        )
        .build()
        .into()
}

pub fn get(url: &str, headers: &[(&str, &str)], timeout: Option<Duration>) -> Result<Fetched> {
    let mut request = agent(timeout).get(url);
    for (name, value) in headers {
        request = request.header(*name, *value);
    }
    let mut response = request.call().map_err(|error| anyhow::anyhow!("{error}"))?;
    let status = response.status().as_u16();
    let body = response
        .body_mut()
        .with_config()
        .limit(2 * 1024 * 1024 * 1024)
        .read_to_vec()
        .map_err(|error| anyhow::anyhow!("{error}"))?;
    Ok(Fetched { status, body })
}

pub fn post_json(url: &str, body: &serde_json::Value, timeout: Option<Duration>) -> Result<Fetched> {
    let mut response = agent(timeout)
        .post(url)
        .header("content-type", "application/json")
        .send(serde_json::to_vec(body)?)
        .map_err(|error| anyhow::anyhow!("{error}"))?;
    let status = response.status().as_u16();
    let body = response.body_mut().read_to_vec().map_err(|error| anyhow::anyhow!("{error}"))?;
    Ok(Fetched { status, body })
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    use sha2::Digest;
    hex(&sha2::Sha256::digest(bytes))
}

pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}
