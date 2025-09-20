package logging

import (
	"strings"

	"github.com/sirupsen/logrus"
)

// Setup configures a global structured logger according to log level string.
func Setup(level string) (*logrus.Logger, error) {
	logger := logrus.New()
	logger.SetFormatter(&logrus.JSONFormatter{})

	lvl, err := logrus.ParseLevel(strings.ToLower(level))
	if err != nil {
		return nil, err
	}
	logger.SetLevel(lvl)

	return logger, nil
}
