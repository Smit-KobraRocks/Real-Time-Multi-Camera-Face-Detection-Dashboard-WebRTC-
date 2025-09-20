package gin

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"
)

type HandlerFunc func(*Context)

type H map[string]any

type route struct {
	pattern  string
	handlers []HandlerFunc
}

type Engine struct {
	routes     map[string][]route
	middleware []HandlerFunc
	pool       sync.Pool
}

type ResponseWriter struct {
	http.ResponseWriter
	status int
}

type Context struct {
	Writer   *ResponseWriter
	Request  *http.Request
	params   map[string]string
	handlers []HandlerFunc
	index    int
	fullPath string
}

const (
	DebugMode   = "debug"
	ReleaseMode = "release"
)

func SetMode(_ string) {}

func New() *Engine {
	e := &Engine{routes: make(map[string][]route)}
	e.pool.New = func() any { return &Context{} }
	return e
}

func (e *Engine) Use(mw ...HandlerFunc) {
	e.middleware = append(e.middleware, mw...)
}

func (e *Engine) addRoute(method, pattern string, handlers []HandlerFunc) {
	e.routes[method] = append(e.routes[method], route{pattern: pattern, handlers: handlers})
}

func (e *Engine) GET(pattern string, handlers ...HandlerFunc) {
	e.addRoute(http.MethodGet, pattern, handlers)
}

func (e *Engine) POST(pattern string, handlers ...HandlerFunc) {
	e.addRoute(http.MethodPost, pattern, handlers)
}

func (e *Engine) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ctx := e.pool.Get().(*Context)
	ctx.reset()
	ctx.Request = r
	ctx.Writer = &ResponseWriter{ResponseWriter: w, status: http.StatusOK}

	if matched := e.handle(ctx); !matched {
		http.NotFound(ctx.Writer, r)
	}

	e.pool.Put(ctx)
}

func (e *Engine) handle(c *Context) bool {
	routes := e.routes[c.Request.Method]
	for _, rt := range routes {
		if params, ok := match(rt.pattern, c.Request.URL.Path); ok {
			c.params = params
			c.fullPath = rt.pattern
			c.handlers = append(c.handlers, e.middleware...)
			c.handlers = append(c.handlers, rt.handlers...)
			c.Next()
			return true
		}
	}
	return false
}

func match(pattern, path string) (map[string]string, bool) {
	pParts := strings.Split(strings.Trim(pattern, "/"), "/")
	pathParts := strings.Split(strings.Trim(path, "/"), "/")

	if len(pParts) != len(pathParts) {
		return nil, false
	}
	params := make(map[string]string)
	for i := range pParts {
		if strings.HasPrefix(pParts[i], ":") {
			params[pParts[i][1:]] = pathParts[i]
			continue
		}
		if pParts[i] != pathParts[i] {
			return nil, false
		}
	}
	return params, true
}

func (c *Context) reset() {
	c.Writer = nil
	c.Request = nil
	c.params = nil
	c.handlers = c.handlers[:0]
	c.index = -1
	c.fullPath = ""
}

func (c *Context) Next() {
	c.index++
	for c.index < len(c.handlers) {
		h := c.handlers[c.index]
		h(c)
		c.index++
	}
}

func (c *Context) Param(name string) string {
	if c.params == nil {
		return ""
	}
	return c.params[name]
}

func (c *Context) JSON(status int, obj any) {
	c.Status(status)
	data, err := json.Marshal(obj)
	if err != nil {
		status = http.StatusInternalServerError
		c.Status(status)
		c.Writer.Write([]byte(`{"error":"json marshal failed"}`))
		return
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.Write(data)
}

func (c *Context) Status(status int) {
	c.Writer.WriteHeader(status)
}

func (c *Context) FullPath() string {
	return c.fullPath
}

func (w *ResponseWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *ResponseWriter) Status() int {
	return w.status
}

func Recovery() HandlerFunc {
	return func(c *Context) {
		defer func() {
			if r := recover(); r != nil {
				c.Status(http.StatusInternalServerError)
				_, _ = c.Writer.Write([]byte("{}"))
			}
		}()
		c.Next()
	}
}
