package pio
import ("testing";"time";"fmt";"path/filepath";"runtime")
func TestZZPerf(t *testing.T){
 n:=5_000_000
 tab:=NewTable(n)
 y:=make([]int64,n);w:=make([]int64,n);c:=make([]string,n);p:=make([]float32,n)
 for i:=range n{y[i]=int64(2014+i/700000);w[i]=int64(i%53+1);c[i]=fmt.Sprintf("%d_%d",i%15000,7);p[i]=float32(i)*0.1}
 tab.I64["iso_year"]=y;tab.I64["iso_week"]=w;tab.Str["cell"]=c;tab.F32["pr"]=p
 path:=filepath.Join(t.TempDir(),"big.parquet")
 s:=time.Now()
 if err:=WriteParquet(path,tab,[]ColumnSpec{{"iso_year",Int16},{"iso_week",Int8},{"cell",String},{"pr",Float32}});err!=nil{t.Fatal(err)}
 t.Log("write",time.Since(s))
 s=time.Now()
 got,err:=ReadParquet(path,nil); if err!=nil{t.Fatal(err)}
 var ms runtime.MemStats; runtime.ReadMemStats(&ms)
 t.Log("read",time.Since(s),got.N, ms.HeapAlloc>>20,"MB")
}
