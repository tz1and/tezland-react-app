import React from 'react';

// from https://github.com/formium/formik/issues/45
//todo ,aybe use this: https://github.com/cds-snc/platform-forms-client/blob/main/components/forms/FileInput/FileInput.tsx

type CustomFileUploadProps = {
  field: any,
  form: any
}

const CustomFileUpload: React.FC<CustomFileUploadProps> = ({field, form}) => { 
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target?.files) {
      const file  =  e.target.files[0];
      const reader = new FileReader();

      console.log(file);

      reader.readAsArrayBuffer(file);

      reader.onload = await function(event) {
          let buffer = event.target?.result
          form.setFieldValue(field.name, buffer);
      }
    }
  };

  return (
    <input type={'file'} onChange={handleChange} className={'form-control'}/>
  );
}

export default CustomFileUpload;
