package camera

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// HTTPAlertDispatcher posts alerts to a backend REST endpoint.
type HTTPAlertDispatcher struct {
	client   *http.Client
	endpoint string
}

// NewHTTPAlertDispatcher creates a dispatcher with the provided base URL and endpoint path.
func NewHTTPAlertDispatcher(baseURL, endpoint string) *HTTPAlertDispatcher {
	return &HTTPAlertDispatcher{
		client:   &http.Client{Timeout: 10 * time.Second},
		endpoint: fmt.Sprintf("%s%s", strings.TrimRight(baseURL, "/"), endpoint),
	}
}

// Dispatch sends the alert JSON payload to the backend service.
func (d *HTTPAlertDispatcher) Dispatch(ctx context.Context, alert Alert) error {
	payload, err := json.Marshal(alert)
	if err != nil {
		return fmt.Errorf("marshal alert: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, d.endpoint, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.client.Do(req)
	if err != nil {
		return fmt.Errorf("send alert: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("unexpected status: %s", resp.Status)
	}

	return nil
}
