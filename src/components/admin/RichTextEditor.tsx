'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

interface RichTextEditorProps {
    content: string;
    onChange: (content: string) => void;
    error?: boolean;
}

const RichTextEditor = ({ content, onChange, error }: RichTextEditorProps) => {
    const editor = useEditor({
        extensions: [StarterKit],
        content: content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none max-w-none min-h-[200px] text-gray-900',
            },
        },
    });

    if (!editor) {
        return <div className="h-64 w-full bg-gray-100 animate-pulse rounded-md" />;
    }

    return (
        <div className={`border-2 rounded-md overflow-hidden ${error ? 'border-red-500' : 'border-gray-400'}`}>
            <div className="bg-gray-100 border-b-2 border-gray-400 p-2 flex gap-2">
                <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`p-2 rounded font-bold text-gray-900 ${editor.isActive('bold') ? 'bg-blue-200 text-blue-800' : 'hover:bg-gray-200'}`}
                    type="button"
                >
                    <strong>B</strong>
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`p-2 rounded italic text-gray-900 ${editor.isActive('italic') ? 'bg-blue-200 text-blue-800' : 'hover:bg-gray-200'}`}
                    type="button"
                >
                    <em>I</em>
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={`p-2 rounded font-bold text-gray-900 ${editor.isActive('heading') ? 'bg-blue-200 text-blue-800' : 'hover:bg-gray-200'}`}
                    type="button"
                >
                    H
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`p-2 rounded text-gray-900 ${editor.isActive('bulletList') ? 'bg-blue-200 text-blue-800' : 'hover:bg-gray-200'}`}
                    type="button"
                >
                    • List
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`p-2 rounded text-gray-900 ${editor.isActive('orderedList') ? 'bg-blue-200 text-blue-800' : 'hover:bg-gray-200'}`}
                    type="button"
                >
                    1. List
                </button>
            </div>
            <EditorContent 
                editor={editor} 
                className="min-h-[200px] p-4 prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none max-w-none bg-white" 
            />
        </div>
    );
};

export default RichTextEditor; 