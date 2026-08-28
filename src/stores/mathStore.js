import { defineStore } from 'pinia';

export const useMathStore = defineStore('math', {
  state: () => ({
    currentQuestion: null,
    currentSolution: null,
  }),
  actions: {
    setCurrentQuestion(question) {
      this.currentQuestion = question;
      this.currentSolution = null;
    },
    setCurrentSolution(solution) {
      this.currentSolution = solution;
    },
  },
});