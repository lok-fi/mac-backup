import React, { useState } from 'react';
import styles from './page.module.css';
import Header from '../../ui/Header';

const supportTeam = [
    {
        name: 'Priya Sharma',
        role: 'Channel Partner Manager',
        email: 'priya.sharma@enerrgiaskyi.com',
        phone: '+91 98765 43210',
        availability: 'Mon-Sat, 9:00 AM - 6:00 PM'
    },
    {
        name: 'Rajesh Kumar',
        role: 'Technical Support Lead',
        email: 'rajesh.kumar@enerrgiaskyi.com',
        phone: '+91 98765 43211',
        availability: 'Mon-Fri, 10:00 AM - 7:00 PM'
    },
    {
        name: 'Anita Desai',
        role: 'Sales Support Executive',
        email: 'anita.desai@enerrgiaskyi.com',
        phone: '+91 98765 43212',
        availability: 'Mon-Sat, 9:00 AM - 6:00 PM'
    }
];

const faqs = [
    {
        question: 'How do I become a channel partner?',
        answer: 'To become a channel partner, complete the registration process and submit your KYC documents. Our team will review your application within 2-3 business days and activate your account upon approval.'
    },
    {
        question: 'What is the commission structure?',
        answer: 'Commission rates vary based on property type and your partnership tier.'
    },
    {
        question: 'When will I receive my commission?',
        answer: 'Commissions are processed within 30 days of successful property registration.'
    }
];

export default function SupportPage() {
    const [expandedFaq, setExpandedFaq] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        alert('Support ticket submitted! Our team will contact you within 24 hours.');
        setFormData({
            name: '',
            email: '',
            phone: '',
            subject: '',
            message: ''
        });
    };

    return (
        <div className={styles.pageWrapper}>
            <Header />

            <div className={styles.container}>
                <h1 className={styles.title}>Support Center</h1>
                <p className={styles.subtitle}>We're here to help you succeed</p>

                {/* Support Team */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Our Support Team</h2>
                    <div className={styles.teamGrid}>
                        {supportTeam.map((member, index) => (
                            <div key={index} className={styles.teamCard}>
                                <div className={styles.avatar}>
                                    {member.name
                                        .split(' ')
                                        .map(n => n[0])
                                        .join('')}
                                </div>

                                <h3>{member.name}</h3>
                                <p className={styles.role}>{member.role}</p>

                                <a href={`mailto:${member.email}`}>{member.email}</a><br />
                                <a href={`tel:${member.phone}`}>{member.phone}</a>

                                <p className={styles.availability}>{member.availability}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Contact Form */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Submit a Support Ticket</h2>

                    <form onSubmit={handleSubmit} className={styles.form}>
                        <input
                            type="text"
                            placeholder="Name"
                            required
                            value={formData.name}
                            onChange={(e) =>
                                setFormData({ ...formData, name: e.target.value })
                            }
                        />

                        <input
                            type="email"
                            placeholder="Email"
                            required
                            value={formData.email}
                            onChange={(e) =>
                                setFormData({ ...formData, email: e.target.value })
                            }
                        />

                        <textarea
                            placeholder="Message"
                            required
                            value={formData.message}
                            onChange={(e) =>
                                setFormData({ ...formData, message: e.target.value })
                            }
                        />

                        <button type="submit">Submit</button>
                    </form>
                </section>

                {/* FAQs */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>FAQs</h2>

                    {faqs.map((faq, index) => (
                        <div key={index}>
                            <button
                                onClick={() =>
                                    setExpandedFaq(expandedFaq === index ? null : index)
                                }
                            >
                                {faq.question}
                            </button>

                            {expandedFaq === index && (
                                <p>{faq.answer}</p>
                            )}
                        </div>
                    ))}
                </section>
            </div>
        </div>
    );
}
