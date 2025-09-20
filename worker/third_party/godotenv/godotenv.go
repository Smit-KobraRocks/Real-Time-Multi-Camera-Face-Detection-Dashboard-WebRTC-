package godotenv

import (
	"bufio"
	"os"
	"strings"
)

// Load reads environment variables from the provided filenames.
// When no filenames are specified it falls back to ".env".
func Load(filenames ...string) error {
	if len(filenames) == 0 {
		filenames = []string{".env"}
	}

	for _, filename := range filenames {
		file, err := os.Open(filename)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return err
		}
		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) != 2 {
				continue
			}
			key := strings.TrimSpace(parts[0])
			value := strings.TrimSpace(parts[1])
			value = strings.Trim(value, "\"'")
			_ = os.Setenv(key, value)
		}
		file.Close()
		if err := scanner.Err(); err != nil {
			return err
		}
	}

	return nil
}
