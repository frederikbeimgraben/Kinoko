// Package pyjson writes JSON byte for byte in the form of Python json.dumps,
// with insertion order and the shortest float text. The manifests use this form.
package pyjson

// Obj is a JSON object that keeps the order of insertion, as a Python dict.
type Obj struct {
	keys []string
	vals map[string]any
}

// NewObj returns an empty object.
func NewObj() *Obj { return &Obj{vals: map[string]any{}} }

// O returns an object from pairs of key and value: O("a", 1, "b", 2).
// It panics when a key is not a string or a value has no key.
func O(pairs ...any) *Obj {
	if len(pairs)%2 != 0 {
		panic("pyjson: O needs pairs of key and value")
	}
	o := NewObj()
	for i := 0; i < len(pairs); i += 2 {
		key, ok := pairs[i].(string)
		if !ok {
			panic("pyjson: O needs a string key")
		}
		o.Set(key, pairs[i+1])
	}
	return o
}

// Set puts v under k and returns o. A key that exists keeps its position, as in a Python dict.
func (o *Obj) Set(k string, v any) *Obj {
	if o.vals == nil {
		o.vals = map[string]any{}
	}
	if _, ok := o.vals[k]; !ok {
		o.keys = append(o.keys, k)
	}
	o.vals[k] = v
	return o
}

// Get returns the value under k.
func (o *Obj) Get(k string) (any, bool) {
	if o == nil {
		return nil, false
	}
	v, ok := o.vals[k]
	return v, ok
}

// Keys returns the keys in the order of insertion.
func (o *Obj) Keys() []string {
	if o == nil {
		return nil
	}
	return append([]string(nil), o.keys...)
}

// Len returns the number of keys.
func (o *Obj) Len() int {
	if o == nil {
		return 0
	}
	return len(o.keys)
}

// Valuer is a type that gives its JSON form as a value that Marshal accepts.
type Valuer interface{ PyJSON() any }
