const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('webhook-spam')
        .setDescription('Belirtilen webhook adresine özel mesaj ve miktar ile spam gönderir.')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('Mesajın gönderileceği Webhook URL adresi')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('mesaj')
                .setDescription('Webhook üzerinden gönderilecek metin')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('miktar')
                .setDescription('Kaç adet mesaj gönderilsin? (1 - 20 arası)')
                .setMinValue(1)
                .setMaxValue(20)
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const webhookUrl = interaction.options.getString('url');
        const messageContent = interaction.options.getString('mesaj');
        const count = interaction.options.getInteger('miktar');

        // URL'nin geçerli bir Discord webhook adresi olup olmadığını kontrol edelim
        if (!webhookUrl.startsWith('https://discord.com/api/webhooks/') && !webhookUrl.startsWith('https://discordapp.com/api/webhooks/')) {
            return interaction.editReply({ content: 'Geçersiz bir Webhook URL adresi girdin!' });
        }

        // Webhook ID ve Token'ını URL'den ayıralım
        const parts = webhookUrl.split('/');
        const webhookId = parts[parts.length - 2];
        const webhookToken = parts[parts.length - 1];

        let successCount = 0;

        try {
            // Belirtilen miktar kadar döngüye sokup rate-limit yememek için araya ufak gecikmeler koyarak gönderelim
            for (let i = 0; i < count; i++) {
                const response = await fetch(`https://discord.com/api/v10/webhooks/${webhookId}/${webhookToken}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        content: messageContent
                    })
                });

                if (response.ok) {
                    successCount++;
                } else {
                    // Rate limit veya hata durumunda biraz bekleyebiliriz
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                // Sunucuyu ve Discord API'yi yormamak adına her istek arasında 500ms bekletelim
                if (i < count - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Webhook Spam Başarılı')
                .setDescription(`İşlem tamamlandı! Toplam **${count}** mesajdan **${successCount}** tanesi başarıyla gönderildi.`)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'Webhook mesajları gönderilirken bir hata oluştu.' });
        }
    },
};
