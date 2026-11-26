import 'package:material_ui/material_ui.dart';

import 'src/api.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const EPodnesociApp());
}

class EPodnesociApp extends StatefulWidget {
  const EPodnesociApp({super.key});

  @override
  State<EPodnesociApp> createState() => _EPodnesociAppState();
}

class _EPodnesociAppState extends State<EPodnesociApp> {
  final PortalApi _api = PortalApi();
  Map<String, dynamic>? _user;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  Future<void> _restore() async {
    try {
      await _api.restoreSession();
      _user = await _api.me();
    } on ApiException {
      // Missing or expired session: show the sign-in screen.
    } catch (_) {
      // Keep sign-in available if the network is offline.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _signIn(String username, String password) async {
    await _api.login(username: username, password: password);
    final user = await _api.me();
    if (mounted) setState(() => _user = user);
  }

  Future<void> _signOut() async {
    try {
      await _api.logout();
    } finally {
      if (mounted) setState(() => _user = null);
    }
  }

  @override
  void dispose() {
    _api.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const navy = Color(0xFF102B46);
    const teal = Color(0xFF147A70);
    return MaterialApp(
      title: 'ZDNP e-ПОДНЕСОЦИ',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: teal,
          primary: teal,
          secondary: const Color(0xFFE9A53A),
          surface: const Color(0xFFF5F7FA),
        ),
        scaffoldBackgroundColor: const Color(0xFFF5F7FA),
        appBarTheme: const AppBarTheme(
          backgroundColor: navy,
          foregroundColor: Colors.white,
        ),
      ),
      home: _loading
          ? const _LoadingScreen()
          : _user == null
              ? LoginScreen(onSignIn: _signIn)
              : DashboardScreen(
                  api: _api,
                  user: _user!,
                  onSignOut: _signOut,
                ),
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({required this.onSignIn, super.key});

  final Future<void> Function(String, String) onSignIn;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.onSignIn(_username.text.trim(), _password.text);
    } on ApiException catch (error) {
      setState(() => _error = error.message);
    } catch (_) {
      setState(() => _error =
          'Не можам да се поврзам со системот. Провери ја интернет-врската.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.all(24),
              children: [
                const _TestBanner(),
                const SizedBox(height: 22),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(28),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Icon(Icons.account_balance_outlined,
                              size: 42, color: Color(0xFF147A70)),
                          const SizedBox(height: 14),
                          Text('ZDNP · e-ПОДНЕСОЦИ',
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.headlineSmall),
                          const SizedBox(height: 8),
                          const Text('Најава за овластени корисници',
                              textAlign: TextAlign.center),
                          const SizedBox(height: 26),
                          TextFormField(
                            controller: _username,
                            textInputAction: TextInputAction.next,
                            autocorrect: false,
                            decoration: const InputDecoration(
                              labelText: 'Корисничко име',
                              prefixIcon: Icon(Icons.person_outline),
                              border: OutlineInputBorder(),
                            ),
                            validator: (value) =>
                                value == null || value.trim().isEmpty
                                    ? 'Внеси корисничко име.'
                                    : null,
                          ),
                          const SizedBox(height: 14),
                          TextFormField(
                            controller: _password,
                            obscureText: true,
                            onFieldSubmitted: (_) => _submit(),
                            decoration: const InputDecoration(
                              labelText: 'Лозинка',
                              prefixIcon: Icon(Icons.lock_outline),
                              border: OutlineInputBorder(),
                            ),
                            validator: (value) =>
                                value == null || value.isEmpty
                                    ? 'Внеси лозинка.'
                                    : null,
                          ),
                          if (_error != null) ...[
                            const SizedBox(height: 14),
                            Text(_error!,
                                style: TextStyle(
                                    color: Theme.of(context)
                                        .colorScheme
                                        .error)),
                          ],
                          const SizedBox(height: 20),
                          FilledButton.icon(
                            onPressed: _busy ? null : _submit,
                            icon: _busy
                                ? const SizedBox.square(
                                    dimension: 18,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2),
                                  )
                                : const Icon(Icons.login),
                            label: Text(_busy ? 'Се најавувам…' : 'Најави се'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Пристапот е ограничен на корисници со доделена сметка.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFF637184)),
                ),
              ],
            ),
          ),
        ),
      );
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({
    required this.api,
    required this.user,
    required this.onSignOut,
    super.key,
  });

  final PortalApi api;
  final Map<String, dynamic> user;
  final Future<void> Function() onSignOut;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _loading = true;
  String? _error;
  List<dynamic> _cases = const [];
  List<dynamic> _users = const [];
  Map<String, dynamic> _analytics = const {};

  String get _role => widget.user['role']?.toString() ?? '';
  bool get _isAdmin => _role == 'institution_admin';

  @override
  void initState() {
    super.initState();
    _load();
    if (widget.user['mustChangePassword'] == true) {
      WidgetsBinding.instance.addPostFrameCallback(
          (_) => _changePassword(required: true));
    }
  }

  Future<void> _changePassword({required bool required}) async {
    final oldPassword = TextEditingController();
    final newPassword = TextEditingController();
    final formKey = GlobalKey<FormState>();
    final changed = await showDialog<bool>(
      context: context,
      barrierDismissible: !required,
      builder: (context) => AlertDialog(
        title: Text(required ? 'Постави нова лозинка' : 'Промени лозинка'),
        content: Form(
          key: formKey,
          child: SizedBox(
            width: 380,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: oldPassword,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Стара лозинка',
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) => value == null || value.isEmpty
                      ? 'Внеси ја старата лозинка.'
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: newPassword,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Нова лозинка (12+ знаци)',
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) => value == null || value.length < 12
                      ? 'Лозинката мора да има најмалку 12 знаци.'
                      : null,
                ),
              ],
            ),
          ),
        ),
        actions: [
          if (!required)
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Откажи'),
            ),
          FilledButton(
            onPressed: () async {
              if (!formKey.currentState!.validate()) return;
              try {
                await widget.api.changePassword(
                  oldPassword: oldPassword.text,
                  newPassword: newPassword.text,
                );
                if (context.mounted) Navigator.pop(context, true);
              } on ApiException catch (error) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(error.message)),
                  );
                }
              }
            },
            child: const Text('Зачувај'),
          ),
        ],
      ),
    );
    oldPassword.dispose();
    newPassword.dispose();
    if (changed == true && mounted) await widget.onSignOut();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      if (_isAdmin) {
        final users = await widget.api.users();
        final analytics = await widget.api.analytics();
        _users = users;
        _analytics = analytics;
      } else if (_role == 'educator' || _role == 'director') {
        _cases = await widget.api.cases();
      }
    } on ApiException catch (error) {
      _error = error.message;
    } catch (_) {
      _error = 'Не можам да ги вчитам податоците.';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final username = widget.user['username']?.toString() ?? '';
    final institution = widget.user['institutionId']?.toString() ?? '';
    return Scaffold(
      appBar: AppBar(
        title: const Text('ZDNP · e-ПОДНЕСОЦИ'),
        actions: [
          IconButton(
            tooltip: 'Промени лозинка',
            onPressed: () => _changePassword(required: false),
            icon: const Icon(Icons.password_outlined),
          ),
          IconButton(
            tooltip: 'Одјави се',
            onPressed: widget.onSignOut,
            icon: const Icon(Icons.logout),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1100),
          child: RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsets.all(22),
              children: [
                const _TestBanner(),
                const SizedBox(height: 16),
                Card(
                  color: const Color(0xFF102B46),
                  child: ListTile(
                    leading: const CircleAvatar(
                      backgroundColor: Color(0xFF147A70),
                      child: Icon(Icons.verified_user_outlined,
                          color: Colors.white),
                    ),
                    title: Text(
                      'Добредојде, $username',
                      style: const TextStyle(
                          color: Colors.white, fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(
                      _roleLabel(_role) +
                          (institution.isEmpty ? '' : ' · ' + institution),
                      style: const TextStyle(color: Color(0xFFD3DEE8)),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                if (_loading)
                  const Padding(
                    padding: EdgeInsets.all(36),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (_error != null)
                  Card(
                    child: ListTile(
                      leading:
                          const Icon(Icons.cloud_off, color: Colors.red),
                      title: const Text('Податоците не се достапни'),
                      subtitle: Text(_error!),
                      trailing: IconButton(
                        onPressed: _load,
                        icon: const Icon(Icons.refresh),
                      ),
                    ),
                  )
                else if (_isAdmin) ...[
                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: [
                      _MetricCard(
                          label: 'Корисници',
                          value: _users.length.toString(),
                          icon: Icons.groups_outlined),
                      _MetricCard(
                          label: 'Активности',
                          value: (_analytics['total'] ?? 0).toString(),
                          icon: Icons.history),
                      if (widget.user['centralAdmin'] == true)
                        const _MetricCard(
                            label: 'Пристап',
                            value: 'Централен',
                            icon: Icons.admin_panel_settings_outlined),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(18),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Корисници',
                              style: Theme.of(context).textTheme.titleLarge),
                          const SizedBox(height: 8),
                          if (_users.isEmpty)
                            const Text('Нема внесени корисници.')
                          else
                            ..._users.map((raw) {
                              final user =
                                  Map<String, dynamic>.from(raw as Map);
                              final name =
                                  user['display_name']?.toString() ?? '';
                              final handle =
                                  user['username']?.toString() ?? '';
                              final enabled = user['enabled'] == 1 ||
                                  user['enabled'] == true;
                              return ListTile(
                                leading: Icon(enabled
                                    ? Icons.person_outline
                                    : Icons.person_off_outlined),
                                title: Text(name.isEmpty ? handle : name),
                                subtitle: Text(
                                  handle +
                                      ' · ' +
                                      _roleLabel(
                                          user['role']?.toString() ?? ''),
                                ),
                                trailing: Text(
                                    enabled ? 'Активен' : 'Неактивен'),
                              );
                            }),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  _ActivityCard(
                      events: _analytics['recent'] as List<dynamic>? ??
                          const []),
                ] else if (_role == 'educator' || _role == 'director') ...[
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(18),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Достапни предмети',
                              style: Theme.of(context).textTheme.titleLarge),
                          const SizedBox(height: 8),
                          if (_cases.isEmpty)
                            const Text('Нема достапни предмети.')
                          else
                            ..._cases.map((raw) {
                              final item =
                                  Map<String, dynamic>.from(raw as Map);
                              return ListTile(
                                leading:
                                    const Icon(Icons.description_outlined),
                                title: Text(item['case_number']?.toString() ??
                                    'Предмет'),
                                subtitle: Text(
                                  (item['category']?.toString() ?? '—') +
                                      ' · ' +
                                      (item['status']?.toString() ?? '—'),
                                ),
                              );
                            }),
                        ],
                      ),
                    ),
                  ),
                ] else
                  const _InfoCard(
                    title: 'Модулот сè уште не е активен',
                    body:
                        'Worker API-то моментално нема достапен работен модул за оваа улога.',
                    icon: Icons.hourglass_empty,
                  ),
                const SizedBox(height: 14),
                const _InfoCard(
                  title: 'Јавни поднесоци',
                  body:
                      'Јавниот формулар за барања и молби е достапен на веб-страницата; во оваа верзија апликацијата е за службените корисници.',
                  icon: Icons.note_add_outlined,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

String _roleLabel(String role) {
  switch (role) {
    case 'educator':
      return 'Воспитувач';
    case 'director':
      return 'Директор';
    case 'institution_admin':
      return 'Администратор';
    case 'service_head':
      return 'Раководител';
    case 'archivist':
      return 'Архивар';
    default:
      return role;
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard(
      {required this.label, required this.value, required this.icon});

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: 230,
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Icon(icon, color: const Color(0xFF147A70)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(value,
                          style: Theme.of(context).textTheme.titleLarge),
                      Text(label, style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}

class _ActivityCard extends StatelessWidget {
  const _ActivityCard({required this.events});

  final List<dynamic> events;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Последни активности',
                  style: Theme.of(context).textTheme.titleLarge),
              if (events.isEmpty)
                const Padding(
                  padding: EdgeInsets.only(top: 10),
                  child: Text('Нема запишани активности.'),
                )
              else
                ...events.reversed.take(12).map((raw) {
                  final event = Map<String, dynamic>.from(raw as Map);
                  return ListTile(
                    dense: true,
                    leading: const Icon(Icons.history, size: 20),
                    title: Text(event['action']?.toString() ?? 'Активност'),
                    subtitle: Text(
                      (event['at']?.toString() ?? '') +
                          ' · корисник ' +
                          (event['actorId']?.toString() ?? '—'),
                    ),
                  );
                }),
            ],
          ),
        ),
      );
}

class _InfoCard extends StatelessWidget {
  const _InfoCard(
      {required this.title, required this.body, required this.icon});

  final String title;
  final String body;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Card(
        child: ListTile(
          leading: Icon(icon, color: const Color(0xFF147A70)),
          title: Text(title),
          subtitle: Text(body),
        ),
      );
}

class _TestBanner extends StatelessWidget {
  const _TestBanner();

  @override
  Widget build(BuildContext context) => const Card(
        color: Color(0xFFFFF3D8),
        child: const Padding(
          padding: EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.warning_amber_rounded, color: Color(0xFF8B5A00)),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'ТЕСТ СИСТЕМ — не внесувај вистински лични или службени податоци.',
                  style: TextStyle(color: Color(0xFF664300)),
                ),
              ),
            ],
          ),
        ),
      );
}

class _LoadingScreen extends StatelessWidget {
  const _LoadingScreen();

  @override
  Widget build(BuildContext context) => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
}
