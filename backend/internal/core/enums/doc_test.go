package enums

import (
	"go/ast"
	"go/parser"
	"go/token"
	"testing"
)

func TestEachConstGroupHasADocComment(t *testing.T) {
	for _, name := range []string{"enums.go", "enums_more.go"} {
		file, err := parser.ParseFile(token.NewFileSet(), name, nil, parser.ParseComments)
		if err != nil {
			t.Fatal(err)
		}
		for _, decl := range file.Decls {
			if group, ok := decl.(*ast.GenDecl); ok && group.Tok == token.CONST && group.Doc == nil {
				t.Errorf("%s: const group of %s has no doc comment", name, group.Specs[0].(*ast.ValueSpec).Names[0])
			}
		}
	}
}
