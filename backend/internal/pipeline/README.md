# Pipeline golden files

The files in the `testdata` folders of the pipeline packages are fixed
reference data. The tests compute the same values in Go and compare them
with these files. Do not change a golden file to make a test pass. Change
a golden file only when the rule that it records changes, and tell the
reason in the commit message.

The rules that the code comments call "finding <n>" are in
[docs/pipeline.md](../../../docs/pipeline.md), section "Numbered rules".
