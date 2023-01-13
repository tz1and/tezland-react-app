import React from 'react';

// from https://github.com/formium/formik/issues/45
//todo maybe use this: https://github.com/cds-snc/platform-forms-client/blob/main/components/forms/FileInput/FileInput.tsx

const acceptedFileMimeTypes = ".gltf, model/gltf+json, .glb, model/gltf-binary, .png, image/png, .jpg, .jpeg, image/jpeg";

type CustomFileUploadProps = {
  field: any,
  form: any,
  disabled: boolean
}

const CustomFileUpload: React.FC<CustomFileUploadProps> = ({field, form, disabled}) => {
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const file = e.target.files[0];
      
      form.setFieldTouched(field.name, true);
      form.setFieldValue(field.name, file);
    }
  };

  return (
    <input type="file" accept={acceptedFileMimeTypes} onChange={handleChange} className="form-control" disabled={disabled}/>
  );
}

export default CustomFileUpload;
