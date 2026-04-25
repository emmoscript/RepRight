jest.mock('react-native-fast-tflite', () => ({
  loadTensorflowModel: jest.fn().mockResolvedValue({
    runSync: () => [new Float32Array(51).fill(0.5)],
    delegate: 'default',
  }),
}));
