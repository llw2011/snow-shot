use urlpattern::{UrlPattern, UrlPatternInit, UrlPatternMatchInput};

fn http_patterns(capability: &str) -> Vec<UrlPattern> {
    let capability: serde_json::Value = serde_json::from_str(capability).unwrap();
    let permission = capability["permissions"]
        .as_array()
        .unwrap()
        .iter()
        .find(|entry| entry["identifier"] == "http:default")
        .expect("HTTP permission is missing");

    permission["allow"]
        .as_array()
        .unwrap()
        .iter()
        .map(|entry| {
            let value = entry["url"].as_str().unwrap();
            let mut init = UrlPatternInit::parse_constructor_string::<regex::Regex>(value, None)
                .unwrap_or_else(|error| panic!("invalid HTTP scope {value}: {error}"));
            // Match the HTTP plugin's handling of omitted paths, search and hash.
            if init
                .search
                .as_ref()
                .map(|part| part.is_empty())
                .unwrap_or(true)
            {
                init.search = Some("*".into());
            }
            if init
                .hash
                .as_ref()
                .map(|part| part.is_empty())
                .unwrap_or(true)
            {
                init.hash = Some("*".into());
            }
            if init
                .pathname
                .as_ref()
                .map(|part| part.is_empty() || part == "/")
                .unwrap_or(true)
            {
                init.pathname = Some("*".into());
            }
            UrlPattern::parse(init, Default::default())
                .unwrap_or_else(|error| panic!("invalid HTTP scope {value}: {error}"))
        })
        .collect()
}

fn allows(patterns: &[UrlPattern], address: &str) -> bool {
    patterns.iter().any(|pattern| {
        pattern
            .test(UrlPatternMatchInput::Url(address.parse().unwrap()))
            .unwrap()
    })
}

#[test]
fn default_http_scope_parses_and_restricts_remote_http() {
    let patterns = http_patterns(include_str!("../capabilities/default.json"));
    for address in [
        "http://127.0.0.1:11434/v1/models",
        "http://localhost:11440/v1/chat/completions?test=1",
        "http://[::1]:11434/v1/models",
        "https://example.com/v1/models",
    ] {
        assert!(allows(&patterns, address), "should allow {address}");
    }
    for address in [
        "http://example.com:11434/v1/models",
        "http://192.168.1.5:11434/v1/models",
        "http://[::2]:11434/v1/models",
    ] {
        assert!(!allows(&patterns, address), "should reject {address}");
    }
}

#[test]
fn custom_http_scope_parses_and_allows_user_managed_services() {
    let patterns = http_patterns(include_str!("../capabilities/custom-network.json"));
    assert!(allows(&patterns, "http://192.168.1.5:11434/v1/models"));
}
