import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }: any) => <div>{children}</div>,
  Routes: ({ children }: any) => <div>{children}</div>,
  Route: ({ element }: any) => <div>{element}</div>,
  Navigate: ({ to }: any) => <div>{`navigate to ${to}`}</div>,
  useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock('axios', () => ({
  post: jest.fn(),
}), { virtual: true });

import App from './App';

test('renders login page', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: '로그인' })).toBeInTheDocument();
});
