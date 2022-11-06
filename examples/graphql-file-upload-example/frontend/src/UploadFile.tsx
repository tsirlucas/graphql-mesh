import { useRef, useState } from 'react';
import { useMutation } from '@apollo/client';

import { GET_FILES, UPLOAD_FILE } from './queries';
import { GetFilesResult } from './types';

export default function UploadFile() {
  const [uploadFile] = useMutation(UPLOAD_FILE);
  const [file, setFile] = useState<File>();
  const inputRef = useRef<HTMLInputElement>(null);
  const onSelectFile = () => {
    setFile(inputRef.current?.files?.[0]);
  };
  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        uploadFile({
          variables: {
            upload: file,
          },
          update(cache, { data: newImage }) {
            const data = cache.readQuery<GetFilesResult>({
              query: GET_FILES,
            });
            const existingFiles = data?.files || [];
            cache.writeQuery({
              query: GET_FILES,
              data: {
                ...data,
                files: [...existingFiles, newImage],
              },
            });
          },
        });
        if (inputRef.current) {
          inputRef.current.value = '';
        }
      }}
    >
      <input type="file" onBlur={onSelectFile} ref={inputRef} />
      <input type="submit" />
    </form>
  );
}
