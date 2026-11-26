import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class PortalApi {
  PortalApi({
    String baseUrl = const String.fromEnvironment(
      'ZDNP_API_BASE_URL',
      defaultValue: 'https://zdnp.org',
    ),
    FlutterSecureStorage? secureStorage,
  })  : _baseUri = Uri.parse(baseUrl),
        _secureStorage = secureStorage ?? const FlutterSecureStorage();

  static const _sessionKey = 'zdnp_e_podnesoci_sid';

  final Uri _baseUri;
  final FlutterSecureStorage _secureStorage;
  final HttpClient _client = HttpClient()
    ..connectionTimeout = const Duration(seconds: 15);

  String? _sessionId;

  Future<void> restoreSession() async {
    _sessionId = await _secureStorage.read(key: _sessionKey);
  }

  Future<Map<String, dynamic>> login({
    required String username,
    required String password,
  }) async {
    final result = await _send(
      '/api/login',
      method: 'POST',
      body: {'username': username, 'password': password},
      useSession: false,
    );
    final cookies =
        result.response.headers[HttpHeaders.setCookieHeader] ?? const <String>[];
    for (final cookie in cookies) {
      final match =
          RegExp(r'(?:^|;\s*)sid=([a-f0-9]{64})(?:;|$)').firstMatch(cookie);
      if (match != null) {
        _sessionId = match.group(1);
        await _secureStorage.write(key: _sessionKey, value: _sessionId);
        return result.body;
      }
    }
    throw const ApiException('Серверот не врати валидна сесија.');
  }

  Future<Map<String, dynamic>> me() => get('/api/me');

  Future<List<dynamic>> cases() async {
    final result = await get('/api/cases');
    return result['cases'] as List<dynamic>? ?? const [];
  }

  Future<List<dynamic>> users() async {
    final result = await get('/api/users');
    return result['users'] as List<dynamic>? ?? const [];
  }

  Future<Map<String, dynamic>> analytics() => get('/api/analytics');

  Future<Map<String, dynamic>> get(String path) async =>
      (await _send(path)).body;

  Future<Map<String, dynamic>> post(
    String path,
    Map<String, Object?> body,
  ) async =>
      (await _send(path, method: 'POST', body: body)).body;

  Future<void> logout() async {
    try {
      await _send('/api/logout', method: 'POST');
    } finally {
      _sessionId = null;
      await _secureStorage.delete(key: _sessionKey);
    }
  }

  Future<_ApiResponse> _send(
    String path, {
    String method = 'GET',
    Map<String, Object?>? body,
    bool useSession = true,
  }) async {
    final uri = _baseUri.resolve(path);
    if (uri.scheme != 'https' && uri.host != 'localhost') {
      throw const ApiException('API адресата мора да користи HTTPS.');
    }
    final request = await _client.openUrl(method, uri);
    request.headers.set(HttpHeaders.acceptHeader, 'application/json');
    if (body != null) {
      request.headers.contentType = ContentType.json;
      request.write(jsonEncode(body));
    }
    if (useSession && _sessionId != null) {
      request.headers.set(HttpHeaders.cookieHeader, 'sid=' + _sessionId!);
    }

    final response = await request.close().timeout(const Duration(seconds: 25));
    final responseText = await utf8.decoder.bind(response).join();
    Map<String, dynamic> decoded = const {};
    if (responseText.isNotEmpty) {
      try {
        final value = jsonDecode(responseText);
        if (value is Map<String, dynamic>) decoded = value;
      } on FormatException {
        throw ApiException(
          'Серверот врати невалиден одговор.',
          statusCode: response.statusCode,
        );
      }
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (response.statusCode == 401 && path != '/api/login') {
        _sessionId = null;
        await _secureStorage.delete(key: _sessionKey);
      }
      final message = response.statusCode == 429
          ? 'Премногу обиди. Почекај неколку минути и обиди се повторно.'
          : decoded['error']?.toString() ?? 'Барањето не успеа.';
      throw ApiException(message, statusCode: response.statusCode);
    }
    return _ApiResponse(response, decoded);
  }

  void dispose() => _client.close(force: true);
}

class _ApiResponse {
  const _ApiResponse(this.response, this.body);

  final HttpClientResponse response;
  final Map<String, dynamic> body;
}
