/* Plain C prototypes of the LightGBM C API functions that this package uses.
   c_api.h includes C++ headers, so cgo cannot include it. */
#ifndef KINOKO_LGBM_API_H
#define KINOKO_LGBM_API_H
#include <stdint.h>
#include <stdlib.h>

typedef void* DatasetHandle;
typedef void* BoosterHandle;

const char* LGBM_GetLastError();
int LGBM_DatasetCreateFromMat(const void* data, int data_type, int32_t nrow, int32_t ncol,
	int is_row_major, const char* parameters, const DatasetHandle reference, DatasetHandle* out);
int LGBM_DatasetSetField(DatasetHandle handle, const char* field_name, const void* field_data,
	int num_element, int type);
int LGBM_DatasetSetFeatureNames(DatasetHandle handle, const char** feature_names, int num_feature_names);
int LGBM_DatasetFree(DatasetHandle handle);
int LGBM_BoosterCreate(const DatasetHandle train_data, const char* parameters, BoosterHandle* out);
int LGBM_BoosterUpdateOneIter(BoosterHandle handle, int* is_finished);
int LGBM_BoosterFeatureImportance(BoosterHandle handle, int num_iteration, int importance_type,
	double* out_results);
int LGBM_BoosterSaveModelToString(BoosterHandle handle, int start_iteration, int num_iteration,
	int feature_importance_type, int64_t buffer_len, int64_t* out_len, char* out_str);
int LGBM_BoosterLoadModelFromString(const char* model_str, int* out_num_iterations, BoosterHandle* out);
int LGBM_BoosterGetNumClasses(BoosterHandle handle, int* out_len);
int LGBM_BoosterGetNumFeature(BoosterHandle handle, int* out_len);
int LGBM_BoosterGetCurrentIteration(BoosterHandle handle, int* out_iteration);
int LGBM_BoosterGetFeatureNames(BoosterHandle handle, const int len, int* out_len,
	const size_t buffer_len, size_t* out_buffer_len, char** out_strs);
int LGBM_BoosterPredictForMat(BoosterHandle handle, const void* data, int data_type,
	int32_t nrow, int32_t ncol, int is_row_major, int predict_type, int start_iteration,
	int num_iteration, const char* parameter, int64_t* out_len, double* out_result);
int LGBM_BoosterFree(BoosterHandle handle);
#endif
