// Package contract applies the OpenAPI document to each request: the path
// must accept the method, each query value must be known, and the input must
// agree with the schema.
package contract

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"regexp"
	"slices"
	"strings"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/auth"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// Prefix is the path prefix of the API.
const Prefix = "/api"

var verbs = []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete}

var parameter = regexp.MustCompile(`\{[^}]+\}`)

// Path is one path template of the document with its operations.
type Path struct {
	Template string
	pattern  *regexp.Regexp
	rank     int
	item     *openapi3.PathItem
	methods  []string
}

// Contract is the parsed document.
type Contract struct {
	Doc   *openapi3.T
	Paths []Path
}

// Load parses the document.
func Load(data []byte) (*Contract, error) {
	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromData(data)
	if err != nil {
		return nil, err
	}
	paths := fn.Map(fn.SortedKeys(doc.Paths.Map()), func(template string) Path {
		item := doc.Paths.Value(template)
		escaped := regexp.QuoteMeta(template)
		escaped = strings.NewReplacer(`\{`, "{", `\}`, "}").Replace(escaped)
		literal := fn.Filter(strings.Split(template, "/"), func(part string) bool {
			return part != "" && !strings.HasPrefix(part, "{")
		})
		return Path{
			Template: template,
			pattern:  regexp.MustCompile("^" + parameter.ReplaceAllString(escaped, "[^/]+") + "$"),
			rank:     len(literal),
			item:     item,
			methods:  methodsOf(item),
		}
	})
	return &Contract{Doc: doc, Paths: paths}, nil
}

func methodsOf(item *openapi3.PathItem) []string {
	found := fn.Filter(verbs, func(verb string) bool { return item.GetOperation(verb) != nil })
	if slices.Contains(found, http.MethodGet) {
		found = append(found, http.MethodHead)
	}
	slices.Sort(found)
	return found
}

// Operations lists each method and template of the document, as "GET /x".
func (c *Contract) Operations() []string {
	return fn.FlatMap(c.Paths, func(p Path) []string {
		return fn.Map(fn.Filter(p.methods, func(m string) bool { return m != http.MethodHead }),
			func(m string) string { return m + " " + p.Template })
	})
}

// match gives the most specific paths that match. Several paths can tie.
func (c *Contract) match(path string) []Path {
	hits := fn.Filter(c.Paths, func(p Path) bool { return p.pattern.MatchString(path) })
	if len(hits) == 0 {
		return nil
	}
	best := slices.MaxFunc(hits, func(a, b Path) int { return a.rank - b.rank }).rank
	return fn.Filter(hits, func(p Path) bool { return p.rank == best })
}

// Middleware applies the contract to each request under Prefix.
func (c *Contract) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path, under := strings.CutPrefix(r.URL.Path, Prefix)
		if !under || r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}
		hits := c.match(path)
		if len(hits) == 0 {
			next.ServeHTTP(w, r)
			return
		}
		allowed := slices.Compact(slices.Sorted(slices.Values(fn.FlatMap(hits, func(p Path) []string { return p.methods }))))
		target, ok := fn.Find(hits, func(p Path) bool { return slices.Contains(p.methods, r.Method) })
		if !ok {
			problem.Write(w, problem.MethodNotAllowed(allowed))
			return
		}
		method := r.Method
		if method == http.MethodHead {
			method = http.MethodGet
		}
		operation := target.item.GetOperation(method)
		if err := c.validate(r, path, target, operation); err != nil {
			problem.Write(w, err)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Permission gives the permission that the operation needs, from x-permission.
func Permission(operation *openapi3.Operation) string {
	value, _ := operation.Extensions["x-permission"].(string)
	return value
}

func (c *Contract) validate(r *http.Request, path string, target Path, operation *openapi3.Operation) error {
	if err := unknownQuery(r, target, operation); err != nil {
		return err
	}
	if permission := Permission(operation); permission != "" {
		if _, err := auth.Guard(r, permission); err != nil {
			return err
		}
	}
	return c.validateInput(r, path, target, operation)
}

func queryNames(item *openapi3.PathItem, operation *openapi3.Operation) []string {
	all := append(slices.Clone(item.Parameters), operation.Parameters...)
	return fn.Map(fn.Filter(all, func(ref *openapi3.ParameterRef) bool {
		return ref.Value != nil && ref.Value.In == openapi3.ParameterInQuery
	}), func(ref *openapi3.ParameterRef) string { return ref.Value.Name })
}

func unknownQuery(r *http.Request, target Path, operation *openapi3.Operation) error {
	known := queryNames(target.item, operation)
	unknown := fn.Filter(fn.SortedKeys(r.URL.Query()), func(key string) bool {
		return !strings.Contains(key, "[") && !slices.Contains(known, key)
	})
	if len(unknown) > 0 {
		return problem.Invalid(fn.Map(unknown, func(key string) problem.FieldError {
			return problem.FieldError{Field: key, Code: "unknown"}
		})...)
	}
	return nil
}

func (c *Contract) validateInput(r *http.Request, path string, target Path, operation *openapi3.Operation) error {
	params := pathParams(target.Template, path)
	jsonBody := strings.HasPrefix(r.Header.Get("Content-Type"), "application/json")
	if jsonBody && r.Body != nil {
		body, err := io.ReadAll(io.LimitReader(r.Body, 4<<20))
		if err != nil {
			return problem.InvalidField("body", "read")
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		defer func() { r.Body = io.NopCloser(bytes.NewReader(body)) }()
	}
	shadow := r.Clone(r.Context())
	shadow.URL.Path = path
	input := &openapi3filter.RequestValidationInput{
		Request:    shadow,
		PathParams: params,
		Route: &routers.Route{
			Spec:      c.Doc,
			Path:      target.Template,
			PathItem:  target.item,
			Method:    r.Method,
			Operation: operation,
		},
		Options: &openapi3filter.Options{
			MultiError:         true,
			ExcludeRequestBody: !jsonBody,
			AuthenticationFunc: openapi3filter.NoopAuthenticationFunc,
		},
	}
	if err := openapi3filter.ValidateRequest(context.WithoutCancel(r.Context()), input); err != nil {
		return toProblem(err)
	}
	return nil
}

func pathParams(template, path string) map[string]string {
	names := strings.Split(strings.Trim(template, "/"), "/")
	values := strings.Split(strings.Trim(path, "/"), "/")
	out := map[string]string{}
	for i, name := range names {
		if strings.HasPrefix(name, "{") && i < len(values) {
			out[strings.Trim(name, "{}")] = values[i]
		}
	}
	return out
}

func toProblem(err error) error {
	var multi openapi3.MultiError
	if errors.As(err, &multi) {
		return problem.Invalid(fn.FlatMap(multi, fieldErrors)...)
	}
	return problem.Invalid(fieldErrors(err)...)
}

func fieldErrors(err error) []problem.FieldError {
	var request *openapi3filter.RequestError
	if !errors.As(err, &request) {
		var multi openapi3.MultiError
		if errors.As(err, &multi) {
			return fn.FlatMap(multi, fieldErrors)
		}
		return []problem.FieldError{{Field: "body", Code: "invalid"}}
	}
	base := ""
	if request.Parameter != nil {
		base = request.Parameter.Name
	}
	var multi openapi3.MultiError
	if errors.As(request.Err, &multi) {
		return fn.FlatMap(multi, func(inner error) []problem.FieldError {
			return schemaErrors(base, inner)
		})
	}
	if request.Err == nil {
		code := "invalid"
		if strings.Contains(request.Reason, "missing") || strings.Contains(request.Reason, "required") {
			code = "missing"
		}
		field := base
		if field == "" {
			field = "body"
		}
		return []problem.FieldError{{Field: field, Code: code}}
	}
	return schemaErrors(base, request.Err)
}

func schemaErrors(base string, err error) []problem.FieldError {
	var schema *openapi3.SchemaError
	if !errors.As(err, &schema) {
		field := base
		if field == "" {
			field = "body"
		}
		code := "invalid"
		if errors.Is(err, openapi3filter.ErrInvalidRequired) {
			code = "missing"
		}
		return []problem.FieldError{{Field: field, Code: code}}
	}
	pointer := schema.JSONPointer()
	if schema.SchemaField == "required" {
		if missing := requiredName(schema.Reason); missing != "" {
			pointer = append(pointer, missing)
		}
	}
	field := strings.Join(fn.Filter(append([]string{base}, pointer...), func(s string) bool { return s != "" }), ".")
	if field == "" {
		field = "body"
	}
	return []problem.FieldError{{Field: field, Code: codeOf(schema)}}
}

var requiredProperty = regexp.MustCompile(`property "([^"]+)" is missing`)

func requiredName(reason string) string {
	found := requiredProperty.FindStringSubmatch(reason)
	if len(found) < 2 {
		return ""
	}
	return found[1]
}

func codeOf(schema *openapi3.SchemaError) string {
	switch schema.SchemaField {
	case "required":
		return "missing"
	case "minLength":
		return "string_too_short"
	case "maxLength":
		return "string_too_long"
	case "minimum", "exclusiveMinimum":
		return "greater_than_equal"
	case "maximum", "exclusiveMaximum":
		return "less_than_equal"
	case "minItems":
		return "too_short"
	case "maxItems":
		return "too_long"
	case "pattern":
		return "string_pattern_mismatch"
	case "enum":
		return "enum"
	case "format":
		return "format"
	case "additionalProperties":
		return "extra_forbidden"
	case "type":
		if schema.Schema != nil && schema.Schema.Type != nil && len(schema.Schema.Type.Slice()) > 0 {
			return schema.Schema.Type.Slice()[0] + "_type"
		}
		return "type"
	default:
		return "invalid"
	}
}
