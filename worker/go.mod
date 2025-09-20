module github.com/example/rt-face-worker

go 1.21

require (
github.com/esimov/pigo/core v0.0.0
github.com/gin-gonic/gin v0.0.0
github.com/joho/godotenv v0.0.0
github.com/pigo/data v0.0.0
github.com/sirupsen/logrus v0.0.0
)

replace github.com/esimov/pigo/core => ./third_party/pigo/core
replace github.com/gin-gonic/gin => ./third_party/gin
replace github.com/joho/godotenv => ./third_party/godotenv
replace github.com/pigo/data => ./third_party/pigo/data
replace github.com/sirupsen/logrus => ./third_party/logrus
