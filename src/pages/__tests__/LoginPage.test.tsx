import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../LoginPage';
import { useAuth } from '../../hooks/useAuth';
import type { AuthContextValue } from '../../providers/AuthProvider';

jest.mock('../../hooks/useAuth', () => ({
  useAuth: jest.fn()
}));

describe('LoginPage', () => {
  const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

  const buildAuthValue = (overrides: Partial<AuthContextValue>): AuthContextValue => ({
    user: null,
    token: null,
    isAuthenticated: false,
    login: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn(),
    ...overrides
  });

  beforeEach(() => {
    mockedUseAuth.mockReset();
  });

  it('submits credentials', async () => {
    const loginSpy = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue(buildAuthValue({ login: loginSpy }));

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/username/i), 'operator');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(loginSpy).toHaveBeenCalledWith({ username: 'operator', password: 'secret' });
  });
});
