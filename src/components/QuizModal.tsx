import { useMemo, useState } from 'react';
import { QUIZ } from '../data/quiz';
import { Audio } from '../game/AudioSystem';
import { addCoins, mutateSave } from '../game/SaveSystem';
import { Btn, Icon, Modal } from './common';

const LETTERS = ['A', 'B', 'C', 'D'];

export function QuizModal({ onClose }: { onClose: () => void }) {
  const q = useMemo(() => QUIZ[Math.floor(Math.random() * QUIZ.length)], []);
  const [answer, setAnswer] = useState<number | null>(null);

  const pick = (i: number) => {
    if (answer !== null) return;
    setAnswer(i);
    if (i === q.correct) {
      addCoins(q.reward);
      mutateSave((s) => ({ stats: { ...s.stats, quizRight: s.stats.quizRight + 1 } }));
      Audio.achievement();
    } else {
      Audio.error();
    }
  };

  return (
    <Modal>
      <div className="quiz">
        <h3>
          <Icon name="help" size={22} /> Quiz de Segurança
        </h3>
        <p className="quiz-q">{q.q}</p>
        <div className="quiz-options">
          {q.options.map((op, i) => {
            let cls = 'quiz-option';
            if (answer !== null) {
              if (i === q.correct) cls += ' correct';
              else if (i === answer) cls += ' wrong';
              else cls += ' faded';
            }
            return (
              <button key={i} className={cls} onClick={() => pick(i)}>
                <span className="quiz-letter">{LETTERS[i]}</span>
                <span>{op}</span>
              </button>
            );
          })}
        </div>
        {answer !== null && (
          <div className={`quiz-result ${answer === q.correct ? 'ok' : 'nok'}`}>
            {answer === q.correct ? (
              <p>
                <Icon name="check" size={18} /> Correto! +{q.reward} minérios
              </p>
            ) : (
              <p>
                <Icon name="warn" size={18} /> {q.explain}
              </p>
            )}
          </div>
        )}
        <div className="btn-row quiz-actions">
          {answer === null ? (
            <Btn variant="ghost" onClick={onClose}>
              Pular
            </Btn>
          ) : (
            <Btn variant="primary" onClick={onClose}>
              Continuar
            </Btn>
          )}
        </div>
      </div>
    </Modal>
  );
}
