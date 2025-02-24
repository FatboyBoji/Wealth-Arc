import React from 'react';

interface LoginFormProps {
    onSubmit: (username: string, password: string) => Promise<void>;
    isLoading: boolean;
    error: string | null;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSubmit, isLoading, error }) => {
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const username = formData.get('username') as string;
        const password = formData.get('password') as string;
        await onSubmit(username, password);
    };

    return (
        <>
            <div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    Admin Login
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Sign in to access the admin dashboard
                </p>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                {error && (
                    <div className="rounded-md bg-red-50 p-4">
                        <div className="text-sm text-red-700">{error}</div>
                    </div>
                )}

                <div className="rounded-md shadow-sm -space-y-px">
                    <div>
                        <label htmlFor="username" className="sr-only">
                            Username
                        </label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            required
                            className="appearance-none rounded-none relative block w-full px-3 py-2 
                                     border border-gray-300 placeholder-gray-500 text-gray-900 
                                     rounded-t-md focus:outline-none focus:ring-blue-500 
                                     focus:border-blue-500 focus:z-10 sm:text-sm"
                            placeholder="Username"
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="sr-only">
                            Password
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            className="appearance-none rounded-none relative block w-full px-3 py-2 
                                     border border-gray-300 placeholder-gray-500 text-gray-900 
                                     rounded-b-md focus:outline-none focus:ring-blue-500 
                                     focus:border-blue-500 focus:z-10 sm:text-sm"
                            placeholder="Password"
                        />
                    </div>
                </div>

                <div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="group relative w-full flex justify-center py-2 px-4 border 
                                 border-transparent text-sm font-medium rounded-md text-white 
                                 bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 
                                 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 
                                 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Signing in...' : 'Sign in'}
                    </button>
                </div>
            </form>
        </>
    );
}; 