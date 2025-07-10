import React, { useState } from 'react';
import axios from 'axios';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: #f5f5f5;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 15px;
  width: 300px;
  padding: 20px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const Input = styled.input`
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
`;

const Button = styled.button`
  padding: 10px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;

  &:hover {
    background-color: #45a049;
  }
`;

const Error = styled.div`
  color: red;
  font-size: 14px;
  margin-top: 10px;
`;

const Link = styled.span`
  color: #4CAF50;
  cursor: pointer;
  margin-top: 10px;

  &:hover {
    text-decoration: underline;
  }
`;

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    if (username.length < 3) {
      setError('사용자 이름은 최소 3자 이상이어야 합니다.');
      return;
    }

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/register`, {
        username,
        email,
        password
      });

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/menu');
    } catch (error: any) {
      if (error.response?.data?.code === 11000) {
        if (error.response.data.keyPattern?.email) {
          setError('이미 사용 중인 이메일입니다.');
        } else if (error.response.data.keyPattern?.username) {
          setError('이미 사용 중인 사용자 이름입니다.');
        }
      } else {
        setError(error.response?.data?.message || '회원가입에 실패했습니다.');
      }
    }
  };

  return (
    <Container>
      <Form onSubmit={handleSubmit}>
        <h2>회원가입</h2>
        <Input
          type="text"
          placeholder="사용자 이름"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          maxLength={20}
        />
        <Input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <Input
          type="password"
          placeholder="비밀번호 확인"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <Button type="submit">회원가입</Button>
        {error && <Error>{error}</Error>}
        <Link onClick={() => navigate('/login')}>
          이미 계정이 있으신가요? 로그인
        </Link>
      </Form>
    </Container>
  );
};

export default Register;