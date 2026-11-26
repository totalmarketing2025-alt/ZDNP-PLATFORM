import 'package:flutter_test/flutter_test.dart';
import 'package:zdnp_e_podnesoci/main.dart';

void main() {
  testWidgets('shows staff sign-in when no session exists', (tester) async {
    await tester.pumpWidget(const EPodnesociApp());
    await tester.pumpAndSettle();

    expect(find.text('Најава за овластени корисници'), findsOneWidget);
    expect(find.text('Корисничко име'), findsOneWidget);
    expect(find.text('Лозинка'), findsOneWidget);
  });
}
