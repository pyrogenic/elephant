import React from 'react';
import { render, screen } from '@testing-library/react';
import Elephant from './Elephant';

test('renders learn react link', () => {
  render(<Elephant />);
  const linkElement = screen.getByText(/test/i);
  expect(linkElement).toBeInTheDocument();
});
