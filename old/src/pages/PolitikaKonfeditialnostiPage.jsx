import { useNavigate } from 'react-router-dom'
import { BackIcon, ShieldIcon } from '../components/Icons.jsx'

const s = {
  container: { display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)', color: 'var(--text)' },
  header: { padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-secondary)', flexShrink: 0 },
  backBtn: { padding: '8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: 'none', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: 800, fontSize: '17px', flex: 1 },
  body: { flex: 1, overflowY: 'auto', padding: '20px', lineHeight: 1.65, fontSize: '14px', color: 'var(--text)' },
  h: { fontSize: '16px', fontWeight: 800, marginTop: '22px', marginBottom: '8px' }
}

export default function PolitikaKonfeditialnostiPage() {
  const navigate = useNavigate()

  return (
    <div style={s.container}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>
          <BackIcon size={20} />
        </button>
        <div style={s.title}>Политика конфиденциальности</div>
        <ShieldIcon size={20} />
      </div>
      <div style={s.body}>
        <p><b>Wintozo</b> уважает вашу конфиденциальность. Настоящая политика описывает, какие данные мы собираем, как они используются и защищаются.</p>

        <div style={s.h}>1. Какие данные мы собираем</div>
        <p>При регистрации вы предоставляете никнейм, юзернейм и пароль (хранится в зашифрованном виде). Вы можете добавить аватарку, описание профиля, фотографии и голосовые сообщения. Мы также сохраняем текстовые сообщения и метаданные (время отправки).</p>

        <div style={s.h}>2. Как используются данные</div>
        <p>Данные используются исключительно для работы мессенджера: доставка сообщений, отображение профилей, синхронизация чатов в реальном времени и предоставление подписки WintozoPro.</p>

        <div style={s.h}>3. Хранение данных</div>
        <p>Текстовые сообщения, описания и данные аккаунтов хранятся на защищённом сервере Supabase. Голосовые, фотографии и аватарки хранятся в отдельном медиа-хранилище Supabase.</p>

        <div style={s.h}>4. Передача данных третьим лицам</div>
        <p>Мы не продаём и не передаём ваши данные третьим лицам, кроме случаев, предусмотренных законодательством.</p>

        <div style={s.h}>5. Безопасность</div>
        <p>Пароли не хранятся в открытом виде. Доступ к вашим сообщениям возможен только внутри чатов, в которых вы состоите.</p>

        <div style={s.h}>6. Удаление аккаунта</div>
        <p>Вы можете запросить удаление аккаунта и всех связанных данных в любой момент через настройки приложения.</p>

        <div style={s.h}>7. Изменения политики</div>
        <p>Мы можем обновлять эту политику. Актуальная версия всегда доступна по этому адресу.</p>
      </div>
    </div>
  )
}
