// Command lintrules checks the repository rules that general linters do not
// know: file size, comment length and comment language (docs/style.md).
package main

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
)

const (
	maxFileLines    = 400
	maxBlockLines   = 2
	maxDocLines     = 3
	maxPackageLines = 6
)

var (
	year       = regexp.MustCompile(`\b20\d{2}-\d{2}-\d{2}\b`)
	prNumber   = regexp.MustCompile(`(?i)(#\d+|\bPR\s*\d+\b)`)
	history    = regexp.MustCompile(`\b(now|previously|formerly|no longer|anymore|used to|was changed)\b`)
	umlaut     = regexp.MustCompile(`[äöüÄÖÜß]`)
	germanWord = regexp.MustCompile(`(?i)\b(der|die|das|und|oder|nicht|mit|für|wird|werden|ist|sind|eine|einer|keine)\b`)
)

type finding struct {
	pos  token.Position
	rule string
	text string
}

func main() {
	root := "."
	if len(os.Args) > 1 {
		root = os.Args[1]
	}
	findings, err := check(root)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	for _, f := range findings {
		fmt.Printf("%s:%d  %s  %s\n", f.pos.Filename, f.pos.Line, f.rule, f.text)
	}
	if len(findings) > 0 {
		os.Exit(1)
	}
}

func check(root string) ([]finding, error) {
	var out []finding
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() && (d.Name() == "testdata" || d.Name() == "vendor" || strings.HasPrefix(d.Name(), ".")) && path != root {
			return filepath.SkipDir
		}
		if d.IsDir() || !strings.HasSuffix(path, ".go") {
			return nil
		}
		found, err := checkFile(path)
		out = append(out, found...)
		return err
	})
	return out, err
}

func checkFile(path string) ([]finding, error) {
	set := token.NewFileSet()
	file, err := parser.ParseFile(set, path, nil, parser.ParseComments)
	if err != nil {
		return nil, err
	}
	var out []finding
	isTest := strings.HasSuffix(path, "_test.go")
	if lines := set.Position(file.End()).Line; !isTest && lines > maxFileLines {
		out = append(out, finding{set.Position(file.Package), "size", fmt.Sprintf("%d lines, limit %d", lines, maxFileLines)})
	}
	docs := docGroups(file)
	for _, group := range file.Comments {
		text := group.Text()
		pos := set.Position(group.Pos())
		lines := strings.Count(strings.TrimRight(text, "\n"), "\n") + 1
		limit := maxBlockLines
		switch {
		case group == file.Doc:
			limit = maxPackageLines
		case slices.Contains(docs, group):
			limit = maxDocLines
		}
		if strings.HasPrefix(strings.TrimSpace(text), "Code generated") || strings.Contains(text, "#cgo") {
			continue
		}
		if lines > limit {
			out = append(out, finding{pos, "comment-length", fmt.Sprintf("%d lines, limit %d", lines, limit)})
		}
		for _, rule := range []struct {
			name string
			re   *regexp.Regexp
		}{{"comment-date", year}, {"comment-pr", prNumber}, {"comment-history", history}, {"comment-german", umlaut}, {"comment-german", germanWord}} {
			if match := rule.re.FindString(text); match != "" {
				out = append(out, finding{pos, rule.name, match})
				break
			}
		}
	}
	return out, nil
}

func docGroups(file *ast.File) []*ast.CommentGroup {
	var out []*ast.CommentGroup
	ast.Inspect(file, func(n ast.Node) bool {
		switch node := n.(type) {
		case *ast.FuncDecl:
			out = append(out, node.Doc)
		case *ast.GenDecl:
			out = append(out, node.Doc)
		case *ast.TypeSpec:
			out = append(out, node.Doc)
		case *ast.ValueSpec:
			out = append(out, node.Doc)
		case *ast.Field:
			out = append(out, node.Doc)
		}
		return true
	})
	return out
}
