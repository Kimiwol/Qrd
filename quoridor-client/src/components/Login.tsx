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

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // 기본 로그 추가
  console.log('Login component rendered');
  console.log('Environment:', process.env.NODE_ENV);
  console.log('API URL:', process.env.REACT_APP_API_URL);

  const handleSubmit = async (e: React.FormEvent) => {
    console.log('handleSubmit called!');
    e.preventDefault();
    setError('');
    
    const apiUrl = process.env.REACT_APP_API_URL;
    console.log('API URL:', apiUrl);
    console.log('Environment:', process.env.NODE_ENV);
    
    try {
      console.log('Attempting login request to:', `${apiUrl}/api/login`);
      
      const response = await axios.post(`${apiUrl}/api/login`, {
        email,
        password
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10초 타임아웃
      });

      console.log('Login successful:', response.data);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/menu');
    } catch (error: any) {
      console.error('Login error:', error);
      console.error('Error response:', error.response);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      
      if (error.code === 'ECONNABORTED') {
        setError('서버 연결 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
      } else if (error.response?.status === 401) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else if (error.response?.status === 0 || !error.response) {
        setError('서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.');
      } else {
        setError(error.response?.data?.error || '로그인에 실패했습니다.');
      }
    }
  };

  return (
    <Container>
      <Form onSubmit={handleSubmit}>
        <h2>로그인</h2>
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
        />
        <Button type="submit">로그인</Button>
        {error && <Error>{error}</Error>}
        <Link onClick={() => navigate('/register')}>
          계정이 없으신가요? 회원가입
        </Link>
      </Form>
    </Container>
  );
};

export default Login;