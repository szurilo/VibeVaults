'use client';

import { useEffect, useState } from 'react';

export function FilePreviewImg({ file, className }: { file: File; className?: string }) {
    const [url, setUrl] = useState('');
    useEffect(() => {
        const objectUrl = URL.createObjectURL(file);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);
    if (!url) return null;
    return <img src={url} alt={file.name} className={className} />;
}
